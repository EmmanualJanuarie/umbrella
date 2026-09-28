import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { api } from "./axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const MUTATING_METHODS = new Set(["post", "patch", "put", "delete"]);

let csrfToken: string | null = null;
let csrfRequest: Promise<string | null> | null = null;

function isEvidenceApiRequest(url?: string) {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return true;
  return url.startsWith(API_URL);
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;

  if (!csrfRequest) {
    csrfRequest = axios
      .get<{ csrfToken: string | null }>(`${API_URL}/auth/csrf`, {
        withCredentials: true,
      })
      .then((response) => {
        csrfToken = response.data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }

  return csrfRequest;
}

function installOnClient(client: AxiosInstance) {
  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const method = config.method?.toLowerCase();

    if (
      !method ||
      !MUTATING_METHODS.has(method) ||
      !isEvidenceApiRequest(config.url) ||
      config.url?.includes("/auth/login") ||
      config.url?.includes("/auth/logout") ||
      config.url?.includes("/auth/csrf")
    ) {
      return config;
    }

    // Admin CRUD uses cookie sessions, so every mutation carries the session CSRF token.
    const token = await getCsrfToken();
    if (token) {
      config.headers.set("x-csrf-token", token);
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => {
      // Login regenerates the server session. Never reuse a CSRF token issued
      // for the anonymous session on the newly authenticated session.
      if (
        response.config.url?.includes("/auth/login") ||
        response.config.url?.includes("/auth/mfa/verify-login")
      ) {
        csrfToken = null;
      }
      return response;
    },
    async (error) => {
      const config = error?.config as
        | (InternalAxiosRequestConfig & { _umbrellaCsrfRetried?: boolean })
        | undefined;
      let message = error?.response?.data?.message;
      if (
        error?.response?.status === 403 &&
        error?.response?.data instanceof Blob
      ) {
        try {
          const parsed = JSON.parse(await error.response.data.text()) as {
            message?: string;
          };
          message = parsed.message;
        } catch {
          message = undefined;
        }
      }
      const invalidCsrf =
        error?.response?.status === 403 &&
        typeof message === "string" &&
        message.toLowerCase().includes("invalid csrf token");

      if (invalidCsrf) {
        csrfToken = null;
        if (config && !config._umbrellaCsrfRetried) {
          config._umbrellaCsrfRetried = true;
          const replacementToken = await getCsrfToken();
          if (replacementToken) {
            config.headers.set("x-csrf-token", replacementToken);
            return client.request(config);
          }
        }
      }
      if (error?.response?.status === 401 || error?.response?.status === 419) {
        window.dispatchEvent(new CustomEvent("umbrella:auth-expired"));
      }
      return Promise.reject(error);
    },
  );
}

export function installCsrfProtection() {
  installOnClient(axios);
  installOnClient(api);
}
