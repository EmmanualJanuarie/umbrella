import { api } from '../api/axios';
import { isPortfolioDemo } from '../config/runtime';

export interface LoginPayload {
  identifier: string;
  password: string;
}

export type LoginResponse =
  | {
      mfa_required: true;
      challenge_id: string;
      message: string;
      user_hint?: { email?: string };
    }
  | {
      mfa_required?: false;
      message: string;
      user: AuthSessionUser;
      role: string;
    };

export type AuthSessionUser = {
  user_id: string;
  email?: string;
  role: string;
  org_id?: string;
  branch_id?: string;
  umbrella_branch_id?: string;
  officer_id?: string;
  organization?: { org_id?: string; name?: string } | null;
  branch?: { branch_id?: string; name?: string } | null;
  umbrellaBranch?: { umbrella_branch_id?: string; name?: string } | null;
};

export type AuthSession = {
  authenticated: boolean;
  user: AuthSessionUser | null;
  session: {
    expires_at: string | null;
    csrf_ready: boolean;
  };
};

export const PORTFOLIO_DEMO_PASSWORD = "Demo@2026";
const PORTFOLIO_SESSION_KEY = "udes:portfolio-demo-user";

export const PORTFOLIO_DEMO_ACCOUNTS: Array<AuthSessionUser & { label: string; identifier: string }> = [
  { label: "Main Super Admin", identifier: "platform@udes.demo", user_id: "demo-main-super-admin", email: "platform@udes.demo", role: "MAIN_SUPER_ADMIN", org_id: "umbrella-systems", branch_id: "umbrella-systems-hq", organization: { org_id: "umbrella-systems", name: "Umbrella Systems" }, branch: { branch_id: "umbrella-systems-hq", name: "Umbrella Systems HQ" } },
  { label: "Super Admin", identifier: "superadmin@udes.demo", user_id: "demo-super-admin", email: "superadmin@udes.demo", role: "SUPER_ADMIN", org_id: "umbrella-systems", branch_id: "umbrella-systems-hq", organization: { org_id: "umbrella-systems", name: "Umbrella Systems" }, branch: { branch_id: "umbrella-systems-hq", name: "Umbrella Systems HQ" } },
  { label: "Organisation Owner", identifier: "owner@udes.demo", user_id: "demo-org-owner", email: "owner@udes.demo", role: "ORG_OWNER", org_id: "demo-organisation", branch_id: "demo-branch", organization: { org_id: "demo-organisation", name: "Northstar Security (Demo)" }, branch: { branch_id: "demo-branch", name: "Cape Town Operations (Demo)" } },
  { label: "Branch Administrator", identifier: "branch@udes.demo", user_id: "demo-branch-admin", email: "branch@udes.demo", role: "BRANCH_ADMIN", org_id: "demo-organisation", branch_id: "demo-branch", organization: { org_id: "demo-organisation", name: "Northstar Security (Demo)" }, branch: { branch_id: "demo-branch", name: "Cape Town Operations (Demo)" } },
  { label: "Officer", identifier: "officer@udes.demo", user_id: "demo-officer", email: "officer@udes.demo", role: "OFFICER", officer_id: "demo-officer-record", org_id: "demo-organisation", branch_id: "demo-branch", organization: { org_id: "demo-organisation", name: "Northstar Security (Demo)" }, branch: { branch_id: "demo-branch", name: "Cape Town Operations (Demo)" } },
];

function portfolioSession(): AuthSession {
  const value = window.sessionStorage.getItem(PORTFOLIO_SESSION_KEY);
  const user = value ? JSON.parse(value) as AuthSessionUser : null;
  return { authenticated: Boolean(user), user, session: { expires_at: null, csrf_ready: true } };
}

type SessionOptions = {
  force?: boolean;
};

let cachedSession: AuthSession | null = null;
let cachedAt = 0;
let inFlightSession: Promise<AuthSession> | null = null;
let retryAfter = 0;

const SESSION_CACHE_MS = 60_000;
const SESSION_FAILURE_BACKOFF_MS = 15_000;

function anonymousSession(): AuthSession {
  return {
    authenticated: false,
    user: null,
    session: {
      expires_at: null,
      csrf_ready: false,
    },
  };
}

export function clearSessionCache() {
  cachedSession = null;
  cachedAt = 0;
  retryAfter = 0;
}

export function seedSessionCache(user: AuthSessionUser | null) {
  cachedSession = user
    ? {
        authenticated: true,
        user,
        session: {
          expires_at: null,
          csrf_ready: true,
        },
      }
    : anonymousSession();
  cachedAt = Date.now();
  retryAfter = 0;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  if (isPortfolioDemo) {
    const account = PORTFOLIO_DEMO_ACCOUNTS.find((item) => item.identifier.toLowerCase() === payload.identifier.trim().toLowerCase());
    if (!account || payload.password !== PORTFOLIO_DEMO_PASSWORD) {
      const error = new Error("Use one of the portfolio demo accounts and the displayed demo password.") as Error & { response?: { status: number; data: { code: string; message: string } } };
      error.response = { status: 401, data: { code: "INVALID_CREDENTIALS", message: error.message } };
      throw error;
    }
    const { label: _label, identifier: _identifier, ...user } = account;
    window.sessionStorage.setItem(PORTFOLIO_SESSION_KEY, JSON.stringify(user));
    seedSessionCache(user);
    return { message: "Portfolio demo signed in", user, role: user.role };
  }
  const { data } = await api.post<LoginResponse>('/auth/login', payload, { timeout: 60000 });
  if (!data.mfa_required) {
    seedSessionCache(data.user);
  }
  return data;
}

export async function verifyLoginMfa(payload: { challenge_id: string; code: string }) {
  const { data } = await api.post('/auth/mfa/verify-login', payload, { timeout: 30000 });
  if (data?.user) {
    seedSessionCache(data.user);
  }
  return data;
}

export async function getMfaStatus(): Promise<{ enabled: boolean; confirmed_at: string | null }> {
  const { data } = await api.get('/auth/mfa/status', { timeout: 20000 });
  return data;
}

export async function setupMfa(): Promise<{ secret: string; otpauth_uri: string }> {
  const { data } = await api.post('/auth/mfa/setup', {}, { timeout: 30000 });
  return data;
}

export async function enableMfa(code: string): Promise<{ enabled: boolean; recovery_codes: string[] }> {
  const { data } = await api.post('/auth/mfa/enable', { code }, { timeout: 30000 });
  return data;
}

export async function disableMfa(code: string): Promise<{ enabled: boolean }> {
  const { data } = await api.post('/auth/mfa/disable', { code }, { timeout: 30000 });
  return data;
}

export async function getSession(options: SessionOptions = {}): Promise<AuthSession> {
  if (isPortfolioDemo) {
    const session = portfolioSession();
    cachedSession = session;
    cachedAt = Date.now();
    return session;
  }
  const now = Date.now();

  if (!options.force && cachedSession && now - cachedAt < SESSION_CACHE_MS) {
    return cachedSession;
  }

  if (!options.force && cachedSession && retryAfter > now) {
    return cachedSession;
  }

  if (inFlightSession) {
    return inFlightSession;
  }

  inFlightSession = api
    .get<AuthSession>('/auth/session', { timeout: 20000 })
    .then(({ data }) => {
      cachedSession = data;
      cachedAt = Date.now();
      retryAfter = 0;
      return data;
    })
    .catch((error) => {
      const status = error?.response?.status;

      if (status === 401 || status === 419) {
        const session = anonymousSession();
        cachedSession = session;
        cachedAt = Date.now();
        retryAfter = 0;
        return session;
      }

      retryAfter = Date.now() + SESSION_FAILURE_BACKOFF_MS;

      if (cachedSession) {
        return cachedSession;
      }

      throw error;
    })
    .finally(() => {
      inFlightSession = null;
    });

  return inFlightSession;
}

export async function logout() {
  if (isPortfolioDemo) {
    window.sessionStorage.removeItem(PORTFOLIO_SESSION_KEY);
    clearSessionCache();
    return;
  }
  await api.post('/auth/logout', undefined, { timeout: 30000 });
  clearSessionCache();
}
