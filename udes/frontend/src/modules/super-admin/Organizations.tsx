import { useState, useMemo, useEffect, useCallback } from "react";
import { type Organization, type Branch, type Officer, type Camera, type Session, type Video } from "../../data/types";
import axios from "axios";
import BranchDetailsModal from "./modals/BranchDetailsModal";
import OrganizationWizardModal from "./modals/OrganizationWizardModal";
import { useActionDialog } from "../../components/modals/ActionDialog";

const runAction = async (action: () => Promise<unknown>, options?: unknown) => {
  void options;
  await action();
};

export default function Organizations() {
  const [orgSearch, setOrgSearch] = useState(""); // Left pane search
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [showOrgForm, setShowOrgForm] = useState(false); // NEW: organization form modal
  const [showOrgWizard, setShowOrgWizard] = useState(false);
  const [orgToEdit, setOrgToEdit] = useState<Organization | null>(null);
  const [showBranchModal, setShowBranchModal] = useState(false);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);

  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchLocation, setBranchLocation] = useState("");

  const [branchMenuOpen, setBranchMenuOpen] = useState<string | null>(null);
  const [branchToEdit, setBranchToEdit] = useState<Branch | null>(null);

  const [selectedVideo, setSelectedVideo] = useState<
  (Video & { officer?: Officer | null; camera?: Camera | null }) | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgActive, setOrgActive] = useState(true);
  const [orgCameraOption, setOrgCameraOption] = useState<"PURCHASED_ONCE_OFF" | "RENTED">("PURCHASED_ONCE_OFF");
  const [orgIsTrial, setOrgIsTrial] = useState(false);
  const [orgTrialEndsAt, setOrgTrialEndsAt] = useState("");

  const [orgMenuOpen, setOrgMenuOpen] = useState<string | null>(null); // org_id of open menu

  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
  const { dialogElement, confirmAction, showMessage } = useActionDialog();

  // Filter organizations by name
  const filteredOrgs = useMemo(() => {
    if (!orgSearch) return organizations;
    return organizations.filter((o) =>
      o.name.toLowerCase().includes(orgSearch.toLowerCase())
    );
  }, [orgSearch, organizations]);

  // Get branches for selected organization
  const orgBranches = useMemo(() => {
    if (!selectedOrg) return [];
    return branches.filter((b) => b.org_id === selectedOrg.org_id);
  }, [selectedOrg, branches]);

  const refreshBranches = useCallback(async () => {
    setLoadingBranches(true);
    try {
      const res = await axios.get(`${API_URL}/branches`, { withCredentials: true });
      setBranches(res.data);
    } catch (err) {
      console.error("Failed to load branches", err);
    } finally {
      setLoadingBranches(false);
    }
  }, [API_URL]);

  const handleDeleteBranch = async (branch: Branch) => {
    runAction(async () => {
      const confirmed = await confirmAction({
        title: "Delete Branch",
        message: `Delete branch "${branch.name}"? This cannot be undone.`,
        confirmLabel: "Delete Branch",
        tone: "danger",
      });
      if (!confirmed) return;

      try {
        await axios.delete(
          `${API_URL}/branches/${branch.branch_id}`,
          { withCredentials: true }
        );

        setBranches((prev) =>
          prev.filter((b) => b.branch_id !== branch.branch_id)
        );

        if (selectedBranch?.branch_id === branch.branch_id) {
          setSelectedBranch(null);
        }
      } catch (err) {
        console.error("Failed to delete branch", err);
        await showMessage({
          title: "Delete Failed",
          message: "Failed to delete branch.",
          tone: "danger",
        });
      }
    },
    {});
  };

  const handleBranchUpdate = async (branch: Branch) => {
    runAction(async () => {
      setBranchToEdit(branch);
      setBranchName(branch.name);
      setBranchLocation(branch.location || "");
      setShowBranchForm(true);
      setBranchMenuOpen(null);
    }, {});
  }
  

  // Sessions filtered by officer
  const branchSessions = useMemo(() => {
    if (!selectedBranch) return [];

    return sessions
      .map((s) => {
        const off = officers.find((o) => o.officer_id === s.officer_id) || null;
        const cam = cameras.find((c) => c.camera_id === s.camera_id) || null;
        return { ...s, officer: off, camera: cam };
      })
      .filter(
        (s) =>
          s.officer &&
          s.officer.user.branch_id?.toString() === selectedBranch.branch_id?.toString()
      );
  }, [selectedBranch, sessions, officers, cameras]);

  // Videos filtered by officer
  const branchVideos = useMemo(() => {
    if (!selectedBranch) return [];

    return videos
      .map((v) => {
        const sess = sessions.find((s) => s.session_id === v.session_id) || null;
        const off = sess ? officers.find((o) => o.officer_id === sess.officer_id) || null : null;
        const cam = sess ? cameras.find((c) => c.camera_id === sess.camera_id) || null : null;

        return { ...v, officer: off, camera: cam };
      })
      .filter(
        (v) =>
          v.officer &&
          v.officer.user.branch_id?.toString() === selectedBranch.branch_id?.toString()
      );
  }, [selectedBranch, videos, sessions, officers, cameras]);;

const handleEditOrganization = (org: Organization) => {
  runAction(async () => {
    setOrgToEdit(org);
    setOrgName(org.name);
    setOrgActive(org.active);
    setOrgCameraOption(org.camera_option ?? "PURCHASED_ONCE_OFF");
    setOrgIsTrial(Boolean(org.is_trial));
    setOrgTrialEndsAt(org.trial_ends_at ? org.trial_ends_at.slice(0, 10) : "");
    setShowOrgForm(true);
  }, {});
};

const handleDeleteOrganization = async (org: Organization) => {
  runAction(async () => {
    const confirmed = await confirmAction({
      title: "Delete Organization",
      message: `Are you sure you want to delete "${org.name}"? This cannot be undone.`,
      confirmLabel: "Delete Organization",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await axios.delete(`${API_URL}/organization/${org.org_id}`, { withCredentials: true });
      setOrganizations((prev) => prev.filter((o) => o.org_id !== org.org_id));
      if (selectedOrg?.org_id === org.org_id) setSelectedOrg(null);
    } catch (err) {
      console.error("Failed to delete organization", err);
      await showMessage({
        title: "Delete Failed",
        message: "Failed to delete organization.",
        tone: "danger",
      });
    }
  },
  {});
};


useEffect(() => {

  const fetchOrganizations = async () => {
    try {
      const res = await axios.get(`${API_URL}/organization`, {
        withCredentials: true,
        params: { search: orgSearch }
      });
      setOrganizations(res.data);
    } catch (err) {
      console.error("Failed to load organizations", err);
    }
  };

  fetchOrganizations();
}, [API_URL, orgSearch]);

useEffect(() => {
  void refreshBranches();
}, [refreshBranches]);

useEffect(() => {
  if (selectedOrg && !loadingBranches && branches.length === 0) {
    void refreshBranches();
  }
}, [branches.length, loadingBranches, refreshBranches, selectedOrg]);

useEffect(() => {
  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/session`, { withCredentials: true });
      setSessions(res.data);
    } catch (err) {
      console.error("Failed to load sessions", err);
    }
  };

  fetchSessions();
}, [API_URL]);


useEffect(() => {
  const fetchOfficers = async () => {
    try {
      const res = await axios.get(`${API_URL}/officer`, { withCredentials: true });
      setOfficers(res.data);
    } catch (err) {
      console.error("Failed to load officers", err);
    }
  };

  fetchOfficers();
}, [API_URL]);

useEffect(() => {
  const fetchVideos = async () => {
    try {
      const res = await axios.get(`${API_URL}/video`, { withCredentials: true });
      setVideos(res.data); // store them in state
    } catch (err) {
      console.error("Failed to load videos", err);
    }
  };

  fetchVideos();
}, [API_URL]);

useEffect(() => {
  const fetchCameras = async () => {
    try {
      const res = await axios.get(`${API_URL}/camera`, {
        withCredentials: true,
      });
      setCameras(res.data);
    } catch (err) {
      console.error("Failed to load cameras", err);
    }
  };

  fetchCameras();
}, [API_URL]);

  return (
    <div className="flex h-full w-full text-white bg-body-black border border-gray-700">
      {/* LEFT PANE */}
      <div className="w-1/4 border-r border-gray-700 overflow-y-auto">
        <div className="p-4 border-b border-gray-700 flex flex-col gap-2">
          {/* ADD ORGANIZATION BUTTON */}
          <button
            className="px-4 py-2 bg-red-600 text-white hover:bg-red-500"
            onClick={() => {
              setOrgToEdit(null);
              setShowOrgWizard(true);
              setOrgName("");
              setOrgActive(true);
              setOrgCameraOption("PURCHASED_ONCE_OFF");
            }}
          >
            + Create Organization
          </button>

          <input
            type="text"
            placeholder="Search organizations..."
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
            className="w-full p-2 border border-gray-700 bg-gray-900 text-white"
          />
        </div>
        {filteredOrgs.map((org) => (
          <div
            key={org.org_id}
            className={`p-4 cursor-pointer hover:bg-gray-800 flex justify-between ${
              selectedOrg?.org_id === org.org_id ? "bg-gray-900" : ""
            }`}
            onClick={async () => {
              setSelectedOrg(org);
              setSelectedBranch(null);

              // Log the click
              try {
                await axios.post(
                  `${API_URL}/organization/access/organization/click`,
                  {}, // no body needed for now
                  { withCredentials: true }
                );
              } catch (err) {
                console.error("Failed to log organization click", err);
              }
            }}
          >
            {/* Org info */}
            <div>
              <div className="font-semibold text-left">{org.name}</div>
              <div className="text-sm text-gray-400">
                Branches: {branches.filter(b => b.org_id === org.org_id).length} | Active: {org.active ? "Yes" : "No"}
              </div>
            </div>

            {/* Ellipsis button */}
            <div className="relative">
              <button
                className="text-gray-400 hover:text-white text-xl px-2 py-1"
                onClick={(e) => {
                  e.stopPropagation(); // prevent org selection
                  setOrgMenuOpen(orgMenuOpen === org.org_id ? null : org.org_id); // toggle menu
                }}
              >
                ⋮
              </button>

              {/* Popup menu */}
              {orgMenuOpen === org.org_id && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-gray-800 border border-gray-700 shadow-lg z-10">
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-700"
                    onClick={() => handleEditOrganization(org)}
                  >
                    Update
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-red-500"
                    onClick={() => handleDeleteOrganization(org)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* RIGHT PANE */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {!selectedOrg ? (
          <p className="text-gray-400">Select an organization to view details</p>
        ) : (
          <>
            <div className="mb-4 border border-white/10 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{selectedOrg.name}</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Cameras: {selectedOrg.camera_option === "RENTED" ? "Rented" : "Purchased (Once-off)"}
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    Branches: {orgBranches.length} | Status: {selectedOrg.active ? "Active" : "Inactive"}
                  </p>
                  {selectedOrg.is_trial && <p className="mt-1 text-sm text-amber-200">Trial access ends: {selectedOrg.trial_ends_at ? new Date(selectedOrg.trial_ends_at).toLocaleDateString() : "not set"}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleEditOrganization(selectedOrg)}
                  className="border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                >
                  Edit Organization
                </button>
              </div>
              <p className="mt-3 text-xs text-white/45">
                Use the branch list below to edit branch details and review users, sessions, videos, and cameras for that branch.
              </p>
            </div>
            {/* Branches */}
            <div className="mb-4 max-h-[400px] overflow-visible">
              <h3 className="font-semibold mb-2 sticky top-0 bg-gray-900 p-3 flex justify-between items-center z-10">
                Branches
                <span className="text-xs text-gray-400 font-normal">
                  Created through the organization wizard
                </span>
              </h3>
              {loadingBranches ? (
                <p className="border border-white/10 bg-black/25 p-3 text-sm text-gray-400">Loading branches...</p>
              ) : orgBranches.length === 0 ? (
                <p className="text-gray-400">No branches available</p>
              ) : (
                orgBranches.map((branch) => (
                  <div
                    key={branch.branch_id}
                    className={`p-2 border border-gray-700 mb-2 hover:bg-gray-800 flex justify-between items-start ${
                      selectedBranch?.branch_id === branch.branch_id ? "bg-gray-900" : ""
                    }`}
                    onClick={async () => {
                      setSelectedBranch(branch)
                      setShowBranchModal(true); // close branch modal if open
                    
                      // Log the branch click
                      try {
                        await axios.post(
                          `${API_URL}/branches/access/branch/click`,
                          {
                            branch_id: branch.branch_id, // clicked branch
                          },
                          { withCredentials: true }
                        );
                      } catch (err) {
                        console.error("Failed to log branch click", err);
                      }
                    }}
                  >
                    {/* Branch info */}
                    <div className="cursor-pointer">
                      <div className="font-semibold text-left">{branch.name}</div>
                      <div className="text-sm text-gray-400 text-left">{branch.location}</div>
                    </div>

                    {/* Ellipsis menu */}
                    <div className="relative">
                      <button
                        className="text-gray-400 hover:text-white px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBranchMenuOpen(
                            branchMenuOpen === branch.branch_id ? null : branch.branch_id
                          );
                        }}
                      >
                        ⋮
                      </button>

                      {branchMenuOpen === branch.branch_id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-gray-800 border border-gray-700 shadow-lg z-10">
                          <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBranchUpdate(branch);
                            }}
                          >
                            Update
                          </button>

                          <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-700 text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBranch(branch);
                              setBranchMenuOpen(null);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {
              <BranchDetailsModal 
                isOpen={showBranchModal}
                onClose={() => setShowBranchModal(false)}
                selectedBranch={selectedBranch}
                branchSessions={branchSessions}
                branchVideos={branchVideos}
                selectedVideo={selectedVideo}
                setSelectedVideo={setSelectedVideo}
                showVideoModal={showVideoModal}
                setShowVideoModal={setShowVideoModal}
              />
            }
          </>
        )}
      </div>

      {/* ORGANIZATION FORM MODAL */}
      {showOrgForm && orgToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">
              Update Organization
            </h3>
            <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const res = await axios.patch(
                        `${API_URL}/organization/${orgToEdit.org_id}`,
                        {
                          name: orgName,
                          active: orgActive,
                          camera_option: orgCameraOption,
                          is_trial: orgIsTrial,
                          trial_ends_at: orgIsTrial && orgTrialEndsAt ? `${orgTrialEndsAt}T23:59:59.999Z` : null,
                        },
                        { withCredentials: true }
                      );

                      setOrganizations((prev) =>
                        prev.map((o) => (o.org_id === orgToEdit.org_id ? res.data : o))
                      );

                      setShowOrgForm(false);
                      setOrgToEdit(null);
                      setOrgName("");
                      setOrgActive(true);
                      setOrgCameraOption("PURCHASED_ONCE_OFF");
                      setOrgIsTrial(false);
                      setOrgTrialEndsAt("");
                    } catch (err) {
                      console.error("Failed to create organization", err);
                      await showMessage({
                        title: "Update Failed",
                        message: "Failed to update organization.",
                        tone: "danger",
                      });
                    }
                  }}
                >
              <input
                type="text"
                placeholder="Organization Name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className="p-2 w-full bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600 mb-3"
              />

              <label className="flex  items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={orgActive}
                  onChange={(e) => setOrgActive(e.target.checked)}
                  className="h-4 w-4 bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
                Active Organization
              </label>

              <div className="mt-3 border border-amber-500/25 bg-amber-500/[0.06] p-3">
                <label className="flex items-center gap-2 text-sm text-amber-100">
                  <input type="checkbox" checked={orgIsTrial} onChange={(e) => setOrgIsTrial(e.target.checked)} className="h-4 w-4 accent-red-600" />
                  Trial organization
                </label>
                {orgIsTrial && <label className="mt-3 block text-sm text-gray-300">Trial ends after<input type="date" required value={orgTrialEndsAt} onChange={(e) => setOrgTrialEndsAt(e.target.value)} className="mt-1 w-full border border-gray-700 bg-gray-800 p-2 text-white" /></label>}
              </div>

              <label className="mt-3 block text-sm text-gray-300">
                Camera Provisioning
                <select
                  value={orgCameraOption}
                  onChange={(e) => setOrgCameraOption(e.target.value as typeof orgCameraOption)}
                  className="mt-1 p-2 w-full bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="PURCHASED_ONCE_OFF">Purchased (Once-off)</option>
                  <option value="RENTED">Rented</option>
                </select>
              </label>

              <div className="flex justify-end gap-2 mt-4">
                 <button
                  type="button"
                  className="px-4 py-2 bg-gray-700  hover:bg-gray-600"
                  onClick={() => setShowOrgForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white"
                  disabled={!orgName.trim()}
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOrgWizard && (
        <OrganizationWizardModal
          onClose={() => setShowOrgWizard(false)}
          onCreated={(organization) => {
            setOrganizations((prev) => [...prev, organization]);
            setSelectedOrg(organization);
            setShowOrgWizard(false);
            void refreshBranches();
          }}
        />
      )}

      

      {showBranchForm && selectedOrg && branchToEdit && (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-gray-900 p-6 w-96 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Update Branch</h3>

          <form
            onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await axios.patch(
                `${API_URL}/branches/${branchToEdit.branch_id}`,
                {
                  name: branchName,
                  location: branchLocation,
                },
                { withCredentials: true }
              );

              setBranches((prev) =>
                prev.map((b) =>
                  b.branch_id === branchToEdit.branch_id ? res.data : b
                )
              );

              setShowBranchForm(false);
              setBranchToEdit(null);
              setBranchName("");
              setBranchLocation("");
            } catch (err) {
              console.error("Failed to save branch", err);
              await showMessage({
                title: "Save Failed",
                message: "Failed to save branch.",
                tone: "danger",
              });
            }
          }}
          >
            <input
              type="text"
              placeholder="Branch Name"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              required
              className="p-2 w-full bg-gray-800 text-white border border-gray-700 mb-3"
            />

            <input
              type="text"
              placeholder="Location (optional)"
              value={branchLocation}
              onChange={(e) => setBranchLocation(e.target.value)}
              className="p-2 w-full bg-gray-800 text-white border border-gray-700 mb-3"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowBranchForm(false);
                  setBranchToEdit(null);
                  setBranchName("");
                  setBranchLocation("");
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white"
                disabled={!branchName.trim()}
              >
                Update
              </button>
            </div>
          </form>
        </div>
      </div>
    )}


      {dialogElement}
    </div>
  );
}
