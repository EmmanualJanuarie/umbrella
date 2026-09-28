/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, verifyLoginMfa } from "../../auth/auth.service";
import { dashboardRouteForRole } from "../../auth/dashboard-routes";
import { useUser } from "../../context/UserContext";
import { clearRememberedDashboardPanes } from "../../hooks/useRememberedDashboardPane";
import { isPortfolioDemo } from "../../config/runtime";
import { PORTFOLIO_DEMO_ACCOUNTS, PORTFOLIO_DEMO_PASSWORD } from "../../auth/auth.service";

export default function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); // <-- custom error message
  const [loginStatus, setLoginStatus] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaEmailHint, setMfaEmailHint] = useState("");
  const submittingRef = useRef(false);
  const navigate = useNavigate();
  const { setUser } = useUser();

  const loginErrorMessage = (err: any) => {
    const response = err?.response?.data;
    const code = response?.code ?? response?.error;
    const backendMessage = response?.message;

    if (err?.code === "ECONNABORTED") {
      return "Login is taking longer than expected. Please try again. If it continues, check backend/database connectivity.";
    }

    switch (code) {
      case "INVALID_CREDENTIALS":
      case "EMAIL_NOT_FOUND":
      case "INVALID_PASSWORD":
        return "We could not sign you in. Check your email address or badge number and password, then try again.";
      case "PASSWORD_NOT_SET":
        return "This account does not have a password set. Please request a password reset.";
      case "USER_DISABLED":
        return "Your account has been disabled. Please contact an administrator.";
      case "ACCOUNT_LOCKED":
        return typeof backendMessage === "string"
          ? backendMessage
          : "Account locked. Try again later.";
      case "LOGIN_SERVICE_UNAVAILABLE":
        return "Login service is temporarily unavailable. Please check the database/backend connection and try again.";
      case "MFA_INVALID_CODE":
        return "The MFA code is incorrect or expired.";
      case "MFA_CHALLENGE_EXPIRED":
        return "MFA verification expired. Please log in again.";
      default:
        if (err?.response?.status === 401) {
          return "We could not sign you in. Check your email address or badge number and password, then try again.";
        }
        if (typeof backendMessage === "string") return backendMessage;
        if (Array.isArray(backendMessage)) return backendMessage.join(", ");
        return "Login failed. Please check your details and try again.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setLoading(true);
    setError(""); // reset previous error
    setLoginStatus("Checking account...");

    const statusTimers = [
      window.setTimeout(() => setLoginStatus("Verifying credentials..."), 500),
      window.setTimeout(() => setLoginStatus("Preparing secure session..."), 1500),
      window.setTimeout(() => setLoginStatus("Connecting to workspace..."), 3000),
      window.setTimeout(() => setLoginStatus("Still securing your session..."), 8000),
      window.setTimeout(() => setLoginStatus("This is taking longer than usual, but we are still trying..."), 20000),
    ];

    try {
      const normalizedIdentifier = identifier.trim();
      const data = await login({
        identifier: normalizedIdentifier.includes("@")
          ? normalizedIdentifier.toLowerCase()
          : normalizedIdentifier.toUpperCase(),
        password,
      });

      if ("mfa_required" in data && data.mfa_required) {
        setMfaChallengeId(data.challenge_id);
        setMfaEmailHint(data.user_hint?.email ?? normalizedIdentifier);
        setLoginStatus("");
        setPassword("");
        return;
      }

      const user = data.user;
      const route = dashboardRouteForRole(user?.role ?? data.role);

      if (route) {
        setLoginStatus("Opening dashboard...");
        clearRememberedDashboardPanes(user.user_id);
        setUser(user);
        sessionStorage.setItem(
          "umbrella-login-confirm-until",
          String(Date.now() + 15000),
        );
        navigate(route, { replace: true });
      } else {
        setLoginStatus("");
        setError("Login succeeded, but this role does not have a dashboard route.");
      }
    } catch (err: any) {
      setLoginStatus("");
      setError(loginErrorMessage(err));
    } finally {
      statusTimers.forEach((timer) => window.clearTimeout(timer));
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;

    submittingRef.current = true;
    setLoading(true);
    setError("");
    setLoginStatus("Verifying security code...");

    try {
      const data = await verifyLoginMfa({
        challenge_id: mfaChallengeId,
        code: mfaCode.trim(),
      });
      const user = data.user;
      const route = dashboardRouteForRole(user?.role ?? data.role);

      if (route) {
        setLoginStatus("Opening dashboard...");
        clearRememberedDashboardPanes(user.user_id);
        setUser(user);
        sessionStorage.setItem(
          "umbrella-login-confirm-until",
          String(Date.now() + 15000),
        );
        navigate(route, { replace: true });
      } else {
        setLoginStatus("");
        setError("MFA succeeded, but this role does not have a dashboard route.");
      }
    } catch (err: any) {
      setLoginStatus("");
      setError(loginErrorMessage(err));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center text-color-white">
      <div className="w-full max-w-md p-8 rounded-lg">
        <h2 className="text-2xl font-extrabold text-center mb-6">LOGIN</h2>

        {isPortfolioDemo && (
          <div className="mb-5 border border-amber-300/35 bg-amber-300/[0.08] p-4 text-left text-sm text-amber-50">
            <p className="font-semibold">Portfolio mode — synthetic data only</p>
            <p className="mt-1 text-xs leading-5 text-amber-100/75">Choose an account below. Every demo account uses password <span className="font-mono text-amber-50">{PORTFOLIO_DEMO_PASSWORD}</span>. No cloud service or real user account is used.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PORTFOLIO_DEMO_ACCOUNTS.map((account) => (
                <button key={account.identifier} type="button" onClick={() => { setIdentifier(account.identifier); setPassword(PORTFOLIO_DEMO_PASSWORD); setError(""); }} className="border border-amber-100/20 bg-black/20 px-3 py-2 text-left text-xs transition hover:bg-amber-100/10">
                  <span className="block font-semibold">{account.label}</span>
                  <span className="mt-0.5 block text-amber-100/65">{account.identifier}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={mfaChallengeId ? handleMfaSubmit : handleSubmit} className="flex flex-col gap-4" autoComplete="off">
          {/* Custom Error Message */}
          {error && (
            <div role="alert" className="mb-2 border border-red-500/45 bg-red-950/35 px-4 py-3 text-left">
              <p className="text-sm font-semibold text-red-200">Sign-in unsuccessful</p>
              <p className="mt-1 text-sm leading-5 text-red-100/75">{error}</p>
            </div>
          )}

          {loading && loginStatus && (
            <div className="border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-xs font-medium text-white/55">
              {loginStatus}
            </div>
          )}

          {mfaChallengeId ? (
            <>
              <div className="border border-white/10 bg-white/[0.03] p-3 text-sm text-white/65">
                Enter the 6-digit code from your authenticator app for{" "}
                <span className="font-semibold text-white">{mfaEmailHint}</span>.
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Authenticator code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="px-4 py-2 border focus:outline-none focus:ring-2 focus:ring-red-600 bg-body-black text-center text-lg tracking-[0.35em]"
                autoComplete="one-time-code"
                name="umbrella-login-mfa"
                required
              />
              <button
                type="button"
                className="text-xs text-white/55 hover:text-white"
                onClick={() => {
                  setMfaChallengeId("");
                  setMfaCode("");
                  setPassword("");
                  setLoginStatus("");
                }}
              >
                Use a different account
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Email Address / Badge No."
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError("");
                }}
                className="px-4 py-2 border focus:outline-none focus:ring-2 focus:ring-red-600 bg-body-black"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                name="umbrella-login-identifier"
                required
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                className="px-4 py-2 border focus:outline-none focus:ring-2 focus:ring-red-600 bg-body-black"
                autoComplete="new-password"
                name="umbrella-login-password"
                required
              />
            </>
          )}

          <div className="flex justify-center mt-4">
            <button
              type="submit"
              className="bg-red-600 text-white py-2 font-bold hover:bg-red-700 transition-colors w-24"
              disabled={loading}
            >
              {loading ? "Please wait" : mfaChallengeId ? "Verify" : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
