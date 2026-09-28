import { useState, useEffect } from "react";
import axios from "axios";

const runAction = async (action: () => Promise<unknown>, options?: unknown) => {
  void options;
  await action();
};

interface AssignBranchModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void; // callback after successful assignment
}

interface Branch {
  branch_id: string;
  name: string;
}

export function AssignBranchModal({ userId, isOpen, onClose, onAssigned }: AssignBranchModalProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

  useEffect(() => {
    if (!isOpen) return;
    const fetchBranches = async () => {
      try {
        const res = await axios.get(`${API_URL}/branches`, { withCredentials: true });
        setBranches(res.data);
      } catch (err) {
        console.error("Failed to fetch branches", err);
      }
    };

    fetchBranches();
  }, [isOpen, API_URL]);

  const handleAssign = async () => {
    runAction(async () => {
      if (!selectedBranch) return;

    setLoading(true);
    try {
      await axios.patch(
        `${API_URL}/user/${userId}/assign-branch`,
        { branch_id: selectedBranch },
        { withCredentials: true }
      );
      onAssigned();
      onClose();
    } catch (err) {
      console.error("Failed to assign branch", err);
      setLoading(false);
    }
    },
  {});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-900 text-white p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">Assign Branch</h3>

        <select
          className="w-full p-2 mb-4 bg-gray-950 border border-gray-700"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
        >
          <option value="">Select a branch</option>
          {branches.map((b) => (
            <option key={b.branch_id} value={b.branch_id}>
              {b.name}
            </option>
          ))}
        </select>

        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 bg-red-600 hover:bg-red-700"
            onClick={handleAssign}
            disabled={loading || !selectedBranch}
          >
            {loading ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>

    </div>
  );
}
