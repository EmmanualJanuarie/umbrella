import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

type Policy = {
  policy_id: string;
  scope: "GLOBAL" | "ORGANIZATION";
  organization_id?: string | null;
  temporary_retention_days: number;
  archive_retention_years: number;
  automatic_deletion_enabled: boolean;
  upload_handover_grace_minutes: number;
  active: boolean;
};

type Admin = { user_id: string; first_name: string; last_name: string; email: string; role: string; active: boolean };

export default function RetentionSettings() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [mfa, setMfa] = useState<{ enabled: boolean; confirmed_at?: string | null } | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [approval, setApproval] = useState({ video_id: "", target_super_admin_id: "", action: "LEGAL_HOLD_APPLY", reason: "", code: "" });
  const [issuedCode, setIssuedCode] = useState<{ code: string; expires: string } | null>(null);

  const load = useCallback(async () => {
    const [policies, status, users] = await Promise.all([
      axios.get<Policy[]>(`${API_URL}/retention/policies`, { withCredentials: true }),
      axios.get<{ enabled: boolean; confirmed_at?: string | null }>(`${API_URL}/retention/mfa/status`, { withCredentials: true }),
      axios.get<Admin[]>(`${API_URL}/platform-admin/umbrella-users`, { withCredentials: true }),
    ]);
    setPolicy(policies.data.find((item) => item.scope === "GLOBAL") ?? {
      policy_id: "new-global-policy",
      scope: "GLOBAL",
      temporary_retention_days: 30,
      archive_retention_years: 7,
      automatic_deletion_enabled: false,
      upload_handover_grace_minutes: 30,
      active: true,
    });
    setMfa(status.data);
    setAdmins(users.data.filter((user) => user.role === "SUPER_ADMIN" && user.active));
  }, []);

  useEffect(() => { void load().catch(() => setMessage("Retention settings could not be loaded.")); }, [load]);

  const startSetup = async () => {
    const response = await axios.post(`${API_URL}/retention/mfa/setup`, {}, { withCredentials: true });
    setSetup(response.data);
    setMessage("Scan the authenticator setup code, then confirm it below.");
  };
  const enableMfa = async () => {
    await axios.post(`${API_URL}/retention/mfa/enable`, { code }, { withCredentials: true });
    setSetup(null); setCode(""); setMessage("Evidence Retention MFA is active."); await load();
  };
  const savePolicy = async () => {
    if (!policy) return;
    await axios.post(`${API_URL}/retention/policies`, {
      temporary_retention_days: policy.temporary_retention_days,
      archive_retention_years: policy.archive_retention_years,
      automatic_deletion_enabled: policy.automatic_deletion_enabled,
      upload_handover_grace_minutes: policy.upload_handover_grace_minutes,
      active: policy.active,
      mfa_code: code,
    }, { withCredentials: true });
    setCode(""); setMessage("Retention policy saved."); await load();
  };
  const issue = async () => {
    const response = await axios.post(`${API_URL}/retention/approvals`, approval, { withCredentials: true });
    setIssuedCode({ code: response.data.approval_code, expires: response.data.expires_at });
    setApproval((current) => ({ ...current, code: "" }));
  };

  return <div className="space-y-4 text-white">
    <header className="border border-white/10 bg-gradient-to-r from-red-950/30 to-black/30 p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Evidence governance</p><h2 className="mt-1 text-xl font-semibold">Retention and archive controls</h2><p className="mt-2 text-sm text-white/55">Evidence metadata and audit history remain permanent. These controls govern object-storage lifecycle only.</p></header>
    {message && <p className="border border-sky-400/30 bg-sky-500/10 p-3 text-sm text-sky-100">{message}</p>}
    <section className="border border-white/10 bg-white/[0.025] p-5"><h3 className="font-semibold">Main Super Admin authenticator</h3><p className="mt-1 text-sm text-white/50">Use a dedicated authenticator entry to approve sensitive evidence lifecycle actions. Do not share your authenticator code.</p>{mfa?.enabled ? <p className="mt-3 text-sm text-emerald-300">Configured {mfa.confirmed_at ? `on ${new Date(mfa.confirmed_at).toLocaleString()}` : ""}.</p> : <button type="button" onClick={() => void startSetup()} className="mt-4 bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500">Set up retention MFA</button>}{setup && <div className="mt-4 space-y-3 border border-amber-500/25 bg-amber-500/5 p-4"><p className="text-sm">Add this secret to your authenticator app:</p><code className="block break-all bg-black/30 p-3 text-xs">{setup.secret}</code><p className="text-xs text-white/45">OTP URI: {setup.otpauth_uri}</p><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-digit authenticator code" className="w-full border border-white/15 bg-black/30 p-2 text-sm"/><button type="button" onClick={() => void enableMfa()} className="bg-red-600 px-4 py-2 text-sm font-semibold">Confirm MFA</button></div>}</section>
    {policy && <section className="border border-white/10 bg-white/[0.025] p-5"><h3 className="font-semibold">Global retention policy</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm">Temporary retention days<input type="number" min={1} max={3650} value={policy.temporary_retention_days} onChange={(e) => setPolicy({ ...policy, temporary_retention_days: Number(e.target.value) })} className="mt-1 w-full border border-white/15 bg-black/30 p-2"/></label><label className="text-sm">Archive retention years<input type="number" min={1} max={100} value={policy.archive_retention_years} onChange={(e) => setPolicy({ ...policy, archive_retention_years: Number(e.target.value) })} className="mt-1 w-full border border-white/15 bg-black/30 p-2"/></label><label className="text-sm">Handover reminder minutes<input type="number" min={0} max={1440} value={policy.upload_handover_grace_minutes} onChange={(e) => setPolicy({ ...policy, upload_handover_grace_minutes: Number(e.target.value) })} className="mt-1 w-full border border-white/15 bg-black/30 p-2"/></label><label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.automatic_deletion_enabled} onChange={(e) => setPolicy({ ...policy, automatic_deletion_enabled: e.target.checked })}/> Enable automatic physical object deletion after retention expiry</label></div><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-digit retention MFA code to save policy" className="mt-4 w-full border border-white/15 bg-black/30 p-2 text-sm"/><button type="button" onClick={() => void savePolicy()} className="mt-3 bg-red-600 px-4 py-2 text-sm font-semibold">Save policy</button></section>}
    {mfa?.enabled && <section className="border border-white/10 bg-white/[0.025] p-5"><h3 className="font-semibold">Issue one-time Super Admin approval</h3><p className="mt-1 text-sm text-white/50">The code works once, only for this video and action, and expires in 15 minutes.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><input value={approval.video_id} onChange={(e) => setApproval({ ...approval, video_id: e.target.value })} placeholder="Evidence video ID" className="border border-white/15 bg-black/30 p-2 text-sm"/><select value={approval.target_super_admin_id} onChange={(e) => setApproval({ ...approval, target_super_admin_id: e.target.value })} className="border border-white/15 bg-black/30 p-2 text-sm"><option value="">Select Super Admin</option>{admins.map((admin) => <option key={admin.user_id} value={admin.user_id}>{admin.first_name} {admin.last_name} · {admin.email}</option>)}</select><select value={approval.action} onChange={(e) => setApproval({ ...approval, action: e.target.value })} className="border border-white/15 bg-black/30 p-2 text-sm">{["LEGAL_HOLD_APPLY", "LEGAL_HOLD_RELEASE", "RETENTION_EXTEND", "ARCHIVE", "DELETE"].map((action) => <option key={action}>{action.replaceAll("_", " ")}</option>)}</select><input value={approval.code} onChange={(e) => setApproval({ ...approval, code: e.target.value })} placeholder="Your 6-digit retention MFA code" className="border border-white/15 bg-black/30 p-2 text-sm"/><textarea value={approval.reason} onChange={(e) => setApproval({ ...approval, reason: e.target.value })} placeholder="Reason for this approval" className="min-h-24 border border-white/15 bg-black/30 p-2 text-sm md:col-span-2"/></div><button type="button" onClick={() => void issue()} className="mt-3 bg-red-600 px-4 py-2 text-sm font-semibold">Issue approval code</button>{issuedCode && <div className="mt-4 border border-amber-500/35 bg-amber-500/10 p-4"><p className="text-sm text-amber-100">Give this code to the selected Super Admin once. It expires {new Date(issuedCode.expires).toLocaleString()}.</p><code className="mt-2 block break-all bg-black/30 p-3 text-lg tracking-widest">{issuedCode.code}</code></div>}</section>}
  </div>;
}
