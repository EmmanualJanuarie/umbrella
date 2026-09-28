import { useState } from "react";

interface AddBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (branchName: string, province: string) => void;
}

// South African provinces
const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

export default function AddBranchModal({ isOpen, onClose, onAdd }: AddBranchModalProps) {
  const [name, setName] = useState("");
  const [province, setProvince] = useState(provinces[0]); // default first option

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-body-black p-6 w-96 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Add Branch</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Branch Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 bg-gray-900 border border-gray-700 focus:ring-2 focus:ring-red-600"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Province</label>
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="w-full p-2 bg-gray-900 border border-gray-700 focus:ring-2 focus:ring-red-600"
            >
              {provinces.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white"
              onClick={() => {
                if (name && province) {
                  onAdd(name, province);
                  setName("");
                  setProvince(provinces[0]);
                  onClose();
                }
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}