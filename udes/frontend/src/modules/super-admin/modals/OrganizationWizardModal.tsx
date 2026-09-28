import { useMemo, useState } from "react";
import axios from "axios";
import { OFFICER_STATUS, type Organization, type OfficerStatus, type Role } from "../../../data/types";

type CameraOption = "PURCHASED_ONCE_OFF" | "RENTED";

type WizardUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: Extract<Role, "BRANCH_ADMIN" | "OFFICER">;
  password: string;
  badge_number: string;
  department: string;
  status: OfficerStatus;
};

type WizardBranch = {
  id: string;
  name: string;
  users: WizardUser[];
};

type CreatedOrganizationResponse = {
  organization: Organization;
  branches: WizardBranch[];
  owner_password_configured: boolean;
};

type Props = {
  onClose: () => void;
  onCreated: (organization: Organization) => void;
};

const departments = [
  "Patrol",
  "Traffic",
  "Criminal Investigations",
  "K9 Unit",
  "SWAT",
  "Internal Affairs",
  "Cyber Crime",
  "Narcotics",
  "Community Policing",
  "Records",
  "Dispatch",
  "Training Academy",
  "Branch Admin",
  "Other",
];

const makeId = () => crypto.randomUUID();

const makeUser = (): WizardUser => ({
  id: makeId(),
  first_name: "",
  last_name: "",
  email: "",
  role: "OFFICER",
  password: "",
  badge_number: "",
  department: "",
  status: OFFICER_STATUS.ACTIVE,
});

const makeBranch = (): WizardBranch => ({
  id: makeId(),
  name: "",
  users: [],
});

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function OrganizationWizardModal({ onClose, onCreated }: Props) {
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [cameraOption, setCameraOption] = useState<CameraOption>("PURCHASED_ONCE_OFF");
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [branches, setBranches] = useState<WizardBranch[]>([makeBranch()]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0].id);
  const [editingUser, setEditingUser] = useState<{ branchId: string; user: WizardUser } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
  const validUser = (user: WizardUser) =>
    Boolean(
        user.first_name.trim() &&
        user.last_name.trim() &&
        isValidEmail(user.email) &&
        user.password.length >= 8 &&
        user.department.trim(),
    );

  const getWizardValidationMessage = (stepToValidate?: number) => {
    const shouldValidate = (targetStep: number) =>
      stepToValidate === undefined || stepToValidate === targetStep;

    if (shouldValidate(0)) {
      if (!orgName.trim()) return "Enter an organization name.";
      if (!ownerFirstName.trim() || !ownerLastName.trim()) return "Enter the owner first name and surname.";
      if (!ownerEmail.trim()) return "Enter the owner email address.";
      if (!isValidEmail(ownerEmail)) return "Enter a valid owner email address.";
      if (ownerPassword.length < 8) return "Owner password must be at least 8 characters.";
      if (isTrial && !trialEndsAt) return "Select the final date for the trial period.";
    }

    if (shouldValidate(0) && !cameraOption) return "Select how cameras will be provided.";

    if (shouldValidate(1)) {
      if (branches.length === 0) return "Create at least one branch.";
      if (branches.some((branch) => !branch.name.trim())) return "Every branch needs a name.";
      const branchNames = branches.map((branch) => branch.name.trim().toLowerCase());
      if (new Set(branchNames).size !== branchNames.length) return "Branch names must be unique.";
    }

    if (shouldValidate(2)) {
      const branchWithoutEnoughUsers = branches.find((branch) => branch.users.length < 2);
      if (branchWithoutEnoughUsers) {
        return `${branchWithoutEnoughUsers.name || "Each branch"} needs at least two users.`;
      }

      const allEmails = [
        ownerEmail.trim().toLowerCase(),
        ...branches.flatMap((branch) => branch.users.map((user) => user.email.trim().toLowerCase())),
      ].filter(Boolean);
      const duplicateEmail = allEmails.find((email, index) => allEmails.indexOf(email) !== index);
      if (duplicateEmail) return `Email ${duplicateEmail} is used more than once.`;

      const branchWithInvalidUser = branches.find((branch) =>
        branch.users.some((user) => !validUser(user)),
      );
      if (branchWithInvalidUser) {
        return `${branchWithInvalidUser.name || "Each branch"} has a user with missing required details.`;
      }
    }

    return null;
  };

  const getStepValidationMessage = () => getWizardValidationMessage(step);

  const canContinue = useMemo(() => {
    if (step === 3) return !getWizardValidationMessage();
    return !getStepValidationMessage();
  }, [branches, cameraOption, isTrial, orgName, ownerEmail, ownerFirstName, ownerLastName, ownerPassword, step, trialEndsAt]);

  const addBranch = () => {
    const branch = makeBranch();
    setBranches((current) => [...current, branch]);
    setSelectedBranchId(branch.id);
  };

  const updateBranchName = (id: string, name: string) => {
    setBranches((current) => current.map((branch) => branch.id === id ? { ...branch, name } : branch));
  };

  const removeBranch = (id: string) => {
    setBranches((current) => {
      const next = current.filter((branch) => branch.id !== id);
      if (!next.some((branch) => branch.id === selectedBranchId)) {
        setSelectedBranchId(next[0]?.id ?? "");
      }
      return next.length ? next : [makeBranch()];
    });
  };

  const saveUser = () => {
    if (!editingUser) return;

    if (!validUser(editingUser.user)) {
      setError("User requires first name, last name, a valid email address, department, and an 8 character password.");
      return;
    }

    setError(null);

    setBranches((current) =>
      current.map((branch) => {
        if (branch.id !== editingUser.branchId) return branch;
        const exists = branch.users.some((user) => user.id === editingUser.user.id);
        return {
          ...branch,
          users: exists
            ? branch.users.map((user) => user.id === editingUser.user.id ? editingUser.user : user)
            : [...branch.users, editingUser.user],
        };
      }),
    );
    setEditingUser(null);
  };

  const deleteUser = (branchId: string, userId: string) => {
    setBranches((current) => current.map((branch) => branch.id === branchId ? { ...branch, users: branch.users.filter((user) => user.id !== userId) } : branch));
  };

  const submit = async () => {
    const validationMessage = getWizardValidationMessage();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await axios.post<CreatedOrganizationResponse>(
        `${API_URL}/organization/wizard`,
        {
          name: orgName.trim(),
          owner: {
            first_name: ownerFirstName.trim(),
            last_name: ownerLastName.trim(),
            email: ownerEmail.trim().toLowerCase(),
            password: ownerPassword,
          },
          camera_option: cameraOption,
          is_trial: isTrial,
          trial_ends_at: isTrial && trialEndsAt ? `${trialEndsAt}T23:59:59.999Z` : undefined,
          branches: branches.map((branch) => ({
            name: branch.name.trim(),
            users: branch.users.map((user) => ({
              first_name: user.first_name.trim(),
              last_name: user.last_name.trim(),
              email: user.email.trim().toLowerCase(),
              role: user.role,
              password: user.password,
              badge_number: user.badge_number.trim() || undefined,
              department: user.department.trim(),
              status: user.status,
            })),
          })),
        },
        { withCredentials: true, timeout: 45000 },
      );

      setCreatedMessage(response.data.owner_password_configured ? "Organization created. Owner password was configured from Step 1." : "Organization created.");
      onCreated(response.data.organization);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.code === "ECONNABORTED") {
          setError("Organization creation timed out. Please check whether it was created, then try again.");
          return;
        }

        const responseData = err.response?.data as { message?: unknown; error?: unknown } | undefined;
        const rawMessage = responseData?.message ?? responseData?.error;
        const readableMessage = Array.isArray(rawMessage)
          ? rawMessage.join(", ")
          : typeof rawMessage === "string"
            ? rawMessage
            : rawMessage
              ? JSON.stringify(rawMessage)
              : "Failed to create organization";

        setError(err.response?.status ? `${err.response.status}: ${readableMessage}` : readableMessage);
        return;
      }

      setError("Failed to create organization");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-950 border border-white/10 w-full max-w-6xl h-[92vh] overflow-hidden text-left text-white shadow-2xl flex flex-col">
        <div className="border-b border-white/10 px-6 py-5 flex items-center justify-between bg-black/35">
          <div>
            <h3 className="text-xl font-semibold">Create Organization</h3>
            <p className="text-sm text-gray-400">A guided setup for the owner, camera provision, branches, and branch users.</p>
          </div>
          <button type="button" onClick={onClose} className="border border-white/10 px-3 py-2 text-sm hover:bg-white/10">Close</button>
        </div>

        <div className="grid grid-cols-[260px_1fr] min-h-0 flex-1">
          <aside className="border-r border-white/10 bg-black/35 p-4 overflow-y-auto">
            {["Organization", "Branches", "Users", "Review"].map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => index <= step && setStep(index)}
                className={`w-full text-left px-4 py-3 mb-2 border transition ${
                  step === index
                    ? "border-red-500 bg-red-600/20"
                    : index < step
                      ? "border-green-500/30 bg-green-500/5 text-white/85"
                      : "border-white/10 bg-white/[0.03] text-white/60"
                }`}
              >
                <span className="block text-xs text-gray-400">Step {index + 1}</span>
                <span className="font-semibold">{label}</span>
              </button>
            ))}
            <div className="mt-5 border border-white/10 bg-white/[0.03] p-3 text-xs text-white/55">
              Camera option: <span className="text-white">{cameraOption === "RENTED" ? "Rented" : "Purchased"}</span>
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.10),transparent_32%)] p-6 pb-24">
            {error && <div className="mb-4 border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>}
            {createdMessage && (
              <div className="mb-4 border border-green-700 bg-green-950/30 px-4 py-3 text-sm text-green-100">
                {createdMessage}
              </div>
            )}

            {step === 0 && (
              <div className="max-w-2xl space-y-4 rounded-none border border-white/10 bg-black/25 p-5">
                <h4 className="text-lg font-semibold">Organization Details</h4>
                <input className="w-full p-3 bg-gray-900 border border-gray-700" placeholder="Organization Name" value={orgName} onChange={(event) => setOrgName(event.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="p-3 bg-gray-900 border border-gray-700" placeholder="Owner First Name" value={ownerFirstName} onChange={(event) => setOwnerFirstName(event.target.value)} />
                  <input className="p-3 bg-gray-900 border border-gray-700" placeholder="Owner Surname" value={ownerLastName} onChange={(event) => setOwnerLastName(event.target.value)} />
                </div>
                <input className="w-full p-3 bg-gray-900 border border-gray-700" placeholder="Owner Email Address" type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} />
                <input className="w-full p-3 bg-gray-900 border border-gray-700" placeholder="Owner Password (minimum 8 characters)" type="password" value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} />
                <div className="border border-amber-500/25 bg-amber-500/[0.06] p-4">
                  <label className="flex items-start gap-3 text-sm text-white/80">
                    <input type="checkbox" checked={isTrial} onChange={(event) => setIsTrial(event.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
                    <span><span className="font-semibold">Trial organization</span><span className="mt-1 block text-xs leading-5 text-white/50">Trial accounts are automatically blocked from signing in after the selected end date, unless a Super Admin turns off trial status.</span></span>
                  </label>
                  {isTrial && <label className="mt-4 block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/45">Trial ends after</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={trialEndsAt} onChange={(event) => setTrialEndsAt(event.target.value)} className="w-full border border-white/10 bg-gray-900 p-3 text-white" /></label>}
                </div>
                <div className="border border-white/10 bg-black/25 p-4">
                  <h5 className="font-semibold">How will the cameras be provided?</h5>
                  <p className="mt-1 text-sm text-gray-400">All organizations receive the same UDES platform capabilities. Billing is based on storage and platform usage.</p>
                  <div className="mt-3 flex gap-3">
                    {[
                      ["PURCHASED_ONCE_OFF", "Purchased (Once-off)"],
                      ["RENTED", "Rented"],
                    ].map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setCameraOption(value as CameraOption)} className={`px-4 py-3 border ${cameraOption === value ? "border-red-500 bg-red-600/20" : "border-white/10 bg-gray-900"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="max-w-3xl border border-white/10 bg-black/25 p-5">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-semibold">Branches</h4>
                  <button type="button" onClick={addBranch} className="px-4 py-2 bg-red-600 hover:bg-red-500">Add Branch</button>
                </div>
                <p className="mt-1 text-sm text-gray-400">Add all branches that this organization needs.</p>
                <div className="mt-4 space-y-3">
                  {branches.map((branch, index) => (
                    <div key={branch.id} className="flex gap-3">
                      <input className="flex-1 p-3 bg-gray-900 border border-gray-700" placeholder={`Branch ${index + 1} Name`} value={branch.name} onChange={(event) => updateBranchName(branch.id, event.target.value)} />
                      <button type="button" onClick={() => removeBranch(branch.id)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && selectedBranch && (
              <div className="grid grid-cols-[260px_1fr] gap-5">
                <div className="space-y-2">
                  {branches.map((branch) => (
                    <button key={branch.id} type="button" onClick={() => setSelectedBranchId(branch.id)} className={`w-full text-left p-3 border ${selectedBranchId === branch.id ? "border-red-500 bg-red-600/20" : "border-white/10 bg-gray-900"}`}>
                      <span className="block font-semibold">{branch.name || "Unnamed branch"}</span>
                      <span className="text-sm text-gray-400">{branch.users.length} users</span>
                    </button>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-semibold">{selectedBranch.name || "Branch"} Users</h4>
                    <button type="button" onClick={() => setEditingUser({ branchId: selectedBranch.id, user: makeUser() })} className="px-4 py-2 bg-red-600 hover:bg-red-500">Add User</button>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">Each branch needs at least two valid users before you can continue.</p>
                  <div className="mt-4 space-y-2">
                    {selectedBranch.users.length === 0 ? <p className="text-gray-400">No users added to this branch.</p> : selectedBranch.users.map((user) => (
                      <div key={user.id} className="border border-gray-700 bg-gray-900 p-3 flex justify-between">
                        <div>
                          <p className="font-semibold">{user.first_name} {user.last_name}</p>
                          <p className="text-sm text-gray-400">{user.email} | {user.role}</p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setEditingUser({ branchId: selectedBranch.id, user })} className="px-3 py-2 bg-gray-800 hover:bg-gray-700">Edit</button>
                          <button type="button" onClick={() => deleteUser(selectedBranch.id, user.id)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-red-300">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Review</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-gray-700 bg-gray-900 p-4"><p className="text-sm text-gray-400">Organization</p><p className="font-semibold">{orgName}</p></div>
                  <div className="border border-gray-700 bg-gray-900 p-4"><p className="text-sm text-gray-400">Camera option</p><p className="font-semibold">{cameraOption === "RENTED" ? "Rented" : "Purchased (Once-off)"}</p></div>
                  <div className="border border-gray-700 bg-gray-900 p-4"><p className="text-sm text-gray-400">Access period</p><p className="font-semibold">{isTrial ? `Trial until ${trialEndsAt || "not set"}` : "Standard access"}</p></div>
                </div>
                <div className="border border-gray-700 bg-gray-900 p-4">
                  <p className="text-sm text-gray-400">Owner</p>
                  <p className="font-semibold">{ownerFirstName} {ownerLastName} | {ownerEmail}</p>
                </div>
                <div className="space-y-2">
                  {branches.map((branch) => (
                    <div key={branch.id} className="border border-gray-700 bg-gray-900 p-4">
                      <p className="font-semibold">{branch.name}</p>
                      <p className={`text-sm ${branch.users.length >= 2 ? "text-gray-400" : "text-red-300"}`}>{branch.users.length} users / minimum 2</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-black/80 px-6 py-4 flex justify-between">
          <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || saving} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50">Back</button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                const validationMessage = getStepValidationMessage();
                if (validationMessage) {
                  setError(validationMessage);
                  return;
                }
                setError(null);
                setStep((current) => current + 1);
              }}
              disabled={!canContinue || saving}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700"
            >
              Next
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={!canContinue || saving || Boolean(createdMessage)} className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700">
              {saving ? "Creating..." : "Create Organization"}
            </button>
          )}
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-gray-950 border border-gray-700 p-5 w-[520px]">
            <h4 className="text-lg font-semibold mb-4">{branches.find((branch) => branch.id === editingUser.branchId)?.name} User</h4>
            <div className="grid grid-cols-2 gap-3">
              <input className="p-2 bg-gray-900 border border-gray-700" placeholder="First Name" value={editingUser.user.first_name} onChange={(event) => setEditingUser({ ...editingUser, user: { ...editingUser.user, first_name: event.target.value } })} />
              <input className="p-2 bg-gray-900 border border-gray-700" placeholder="Last Name" value={editingUser.user.last_name} onChange={(event) => setEditingUser({ ...editingUser, user: { ...editingUser.user, last_name: event.target.value } })} />
              <input className="p-2 bg-gray-900 border border-gray-700 col-span-2" placeholder="Email" type="email" value={editingUser.user.email} onChange={(event) => setEditingUser({ ...editingUser, user: { ...editingUser.user, email: event.target.value } })} />
              <select className="p-2 bg-gray-900 border border-gray-700" value={editingUser.user.role} onChange={(event) => setEditingUser({ ...editingUser, user: { ...editingUser.user, role: event.target.value as WizardUser["role"] } })}>
                <option value="OFFICER">OFFICER</option>
                <option value="BRANCH_ADMIN">BRANCH ADMIN</option>
              </select>
              <select className="p-2 bg-gray-900 border border-gray-700" value={editingUser.user.status} onChange={(event) => setEditingUser({ ...editingUser, user: { ...editingUser.user, status: event.target.value as OfficerStatus } })}>
                <option value={OFFICER_STATUS.ACTIVE}>ACTIVE</option>
                <option value={OFFICER_STATUS.INACTIVE}>INACTIVE</option>
              </select>
              <input className="p-2 bg-gray-900 border border-gray-700" placeholder="Badge Number" value={editingUser.user.badge_number} onChange={(event) => setEditingUser({ ...editingUser, user: { ...editingUser.user, badge_number: event.target.value } })} />
              <select className="p-2 bg-gray-900 border border-gray-700" value={editingUser.user.department} onChange={(event) => setEditingUser({ ...editingUser, user: { ...editingUser.user, department: event.target.value } })}>
                <option value="">Select Department</option>
                {departments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
              <input className="p-2 bg-gray-900 border border-gray-700 col-span-2" placeholder="Password" value={editingUser.user.password} onChange={(event) => setEditingUser({ ...editingUser, user: { ...editingUser.user, password: event.target.value } })} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700">Cancel</button>
              <button type="button" onClick={saveUser} className="px-4 py-2 bg-red-600 hover:bg-red-500">Save User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
