import { useState, useEffect, useRef } from "react";
import Icon from "../../common/Icon";
import Logo from "../../common/Logo";
import { disableMfa, enableMfa, getMfaStatus, logout, setupMfa } from "../../auth/auth.service";
import { useUser } from "../../context/UserContext";
import "../../app/ripple.css";
import { useActionDialog } from "./ActionDialog";
import { useNavigate } from "react-router-dom";

type DropdownMenuProps = {
  defaultIcon: string;
  hoverIcon: string;
};

export default function DashboardDropdownMenu({ defaultIcon, hoverIcon }: DropdownMenuProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaConfirmedAt, setMfaConfirmedAt] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaOtpUri, setMfaOtpUri] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState<string[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const { dialogElement, confirmAction, showMessage } = useActionDialog();

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const { setUser } = useUser();

  const loadMfaStatus = async () => {
    const status = await getMfaStatus();
    setMfaEnabled(status.enabled);
    setMfaConfirmedAt(status.confirmed_at);
  };

  const openSecurity = async () => {
    setOpen(false);
    setSecurityOpen(true);
    setSecurityError("");
    setMfaSecret("");
    setMfaOtpUri("");
    setMfaCode("");
    setMfaRecoveryCodes([]);
    try {
      setSecurityLoading(true);
      await loadMfaStatus();
    } catch (err) {
      console.error("Failed to load MFA status:", err);
      setSecurityError("Security settings could not be loaded.");
    } finally {
      setSecurityLoading(false);
    }
  };

  const startMfaSetup = async () => {
    try {
      setSecurityLoading(true);
      setSecurityError("");
      setMfaRecoveryCodes([]);
      const setup = await setupMfa();
      setMfaSecret(setup.secret);
      setMfaOtpUri(setup.otpauth_uri);
    } catch (err) {
      console.error("Failed to start MFA setup:", err);
      setSecurityError("MFA setup could not be started.");
    } finally {
      setSecurityLoading(false);
    }
  };

  const confirmMfa = async () => {
    try {
      setSecurityLoading(true);
      setSecurityError("");
      const result = await enableMfa(mfaCode);
      setMfaEnabled(result.enabled);
      setMfaRecoveryCodes(result.recovery_codes);
      setMfaSecret("");
      setMfaOtpUri("");
      setMfaCode("");
      await loadMfaStatus();
    } catch (err) {
      console.error("Failed to enable MFA:", err);
      setSecurityError("The MFA code is incorrect or expired.");
    } finally {
      setSecurityLoading(false);
    }
  };

  const turnOffMfa = async () => {
    try {
      setSecurityLoading(true);
      setSecurityError("");
      await disableMfa(mfaCode);
      setMfaEnabled(false);
      setMfaConfirmedAt(null);
      setMfaCode("");
      setMfaRecoveryCodes([]);
      await showMessage({
        title: "MFA Disabled",
        message: "Multi-factor authentication has been disabled for your account.",
        tone: "info",
      });
    } catch (err) {
      console.error("Failed to disable MFA:", err);
      setSecurityError("Enter a valid MFA or recovery code to disable MFA.");
    } finally {
      setSecurityLoading(false);
    }
  };

     //Detect outside clicks
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

  return (
    <div ref={dropdownRef} className="relative">
      {loggingOut && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-body-black/95">
          <div className="absolute flex items-center justify-center">
            <span className="ripple ripple-1"></span>
            <span className="ripple ripple-2"></span>
            <span className="ripple ripple-3"></span>
          </div>
          <div className="z-10">
            <Logo set_classname="logo-rem-3" />
          </div>
        </div>
      )}

      <Icon set_default_src={defaultIcon} set_hover_src={hoverIcon} isOpen={open} onToggle={setOpen} set_classname="w-6 h-6" />

      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white shadow-lg z-50">
          <ul className="flex flex-col text-gray-800">
            <li
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => void openSecurity()}
            >
              Security
            </li>
            <li
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={async () => {
                const confirmLogout = await confirmAction({
                  title: "Log Out",
                  message: "Are you sure you want to end this secure session?",
                  confirmLabel: "Log Out",
                  tone: "danger",
                });
                if (!confirmLogout) return;
                try {
                  setLoggingOut(true);
                  await logout();
                  setUser(null);
                  navigate("/login", { replace: true });
                } catch (err) {
                  console.error("Logout failed:", err);
                  setLoggingOut(false);
                  await showMessage({
                    title: "Logout Failed",
                    message: "Failed to log out. Please try again.",
                    tone: "danger",
                  });
                }
              }}
            >
              Log Out
            </li>
          </ul>
        </div>
      )}

      {securityOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-white/10 bg-body-black p-5 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
                  Account security
                </p>
                <h2 className="mt-1 text-xl font-bold">Multi-factor authentication</h2>
                <p className="mt-1 text-sm text-white/55">
                  Protect dashboard access with a one-time code from an authenticator app.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSecurityOpen(false)}
                className="border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {securityLoading && (
              <div className="mt-4 border border-white/10 bg-white/[0.03] p-3 text-sm text-white/55">
                Updating security settings...
              </div>
            )}

            {securityError && (
              <div className="mt-4 border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-100">
                {securityError}
              </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">Status</p>
                <p className={`mt-2 text-lg font-semibold ${mfaEnabled ? "text-emerald-300" : "text-red-200"}`}>
                  {mfaEnabled ? "Enabled" : "Not enabled"}
                </p>
                {mfaConfirmedAt && (
                  <p className="mt-1 text-xs text-white/45">
                    Enabled {new Date(mfaConfirmedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">Recommended</p>
                <p className="mt-2 text-sm text-white/65">
                  Use Microsoft Authenticator, Google Authenticator, 1Password, or any TOTP app.
                </p>
              </div>
            </div>

            {!mfaEnabled && !mfaSecret && (
              <button
                type="button"
                onClick={() => void startMfaSetup()}
                disabled={securityLoading}
                className="mt-4 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Set Up MFA
              </button>
            )}

            {!mfaEnabled && mfaSecret && (
              <div className="mt-4 space-y-4 border border-white/10 bg-black/25 p-4">
                <div>
                  <p className="text-sm font-semibold">1. Add this account to your authenticator app</p>
                  <p className="mt-1 text-xs text-white/50">
                    Choose manual entry and use this secret. Keep it private.
                  </p>
                  <div className="mt-3 break-all border border-white/10 bg-gray-950 p-3 font-mono text-sm text-white/80">
                    {mfaSecret}
                  </div>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(mfaSecret)}
                    className="mt-2 border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
                  >
                    Copy Secret
                  </button>
                  <details className="mt-3 text-xs text-white/45">
                    <summary className="cursor-pointer text-white/65">Advanced otpauth URI</summary>
                    <p className="mt-2 break-all font-mono">{mfaOtpUri}</p>
                  </details>
                </div>

                <div>
                  <p className="text-sm font-semibold">2. Enter the 6-digit code</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="border border-white/10 bg-gray-950 px-3 py-2 text-center tracking-[0.35em] text-white outline-none focus:ring-2 focus:ring-red-600"
                      placeholder="000000"
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      onClick={() => void confirmMfa()}
                      disabled={securityLoading || mfaCode.length !== 6}
                      className="bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      Enable MFA
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mfaEnabled && (
              <div className="mt-4 border border-white/10 bg-black/25 p-4">
                <p className="text-sm font-semibold">Disable MFA</p>
                <p className="mt-1 text-xs text-white/50">
                  Enter an authenticator code or unused recovery code.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.trim())}
                    className="border border-white/10 bg-gray-950 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="Code or recovery code"
                  />
                  <button
                    type="button"
                    onClick={() => void turnOffMfa()}
                    disabled={securityLoading || !mfaCode.trim()}
                    className="border border-red-500/50 bg-red-600/20 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-600 disabled:opacity-60"
                  >
                    Disable
                  </button>
                </div>
              </div>
            )}

            {mfaRecoveryCodes.length > 0 && (
              <div className="mt-4 border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-amber-100">Save these recovery codes now</p>
                <p className="mt-1 text-xs text-amber-100/70">
                  They are shown once. Each code can be used one time if the authenticator app is unavailable.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {mfaRecoveryCodes.map((code) => (
                    <span key={code} className="border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {dialogElement}
    </div>
  );
}
