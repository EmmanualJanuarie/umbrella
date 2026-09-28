import { useState } from "react";
import type { Camera } from "../../data/types";
import { UserName } from "../helpers/UserName";

type CameraTableProps = {
  cameras: Camera[];
  type: "ASSIGNED" | "UNASSIGNED";
  search: string;
  onSelectCamera: (camera: Camera) => void;
  onUpdateCamera?: (camera: Camera) => void;
  onDeleteCamera?: (camera: Camera) => void;
};

export default function CameraTable({
  cameras,
  type,
  onSelectCamera,
  onUpdateCamera,
  onDeleteCamera,
}: CameraTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredCameras = cameras.filter((c) =>
    type === "ASSIGNED"
      ? c.status !== "IN_STOCK" && c.status !== "UNASSIGNED"
      : c.status === "IN_STOCK" || c.status === "UNASSIGNED"
  );

  const getStatusBadge = (status: Camera["status"]) => {
    switch (status) {
      case "ACTIVE":
        return "text-green-500";
      case "INACTIVE":
        return "text-orange-500";
      case "IN_STOCK":
        return "text-blue-500";
      case "DAMAGED":
        return "text-red-500";
      case "LOST":
        return "text-purple-600";
      case "UNASSIGNED":
        return "text-gray-300";
      default:
        return "text-gray-600";
    }
  };


  return (
    <div className="overflow-y-auto h-[400px] border border-gray-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-900 sticky top-0">
          <tr>
            <th className="p-3 border-b border-gray-700">Serial</th>
            <th className="p-3 border-b border-gray-700">Model</th>
            <th className="p-3 border-b border-gray-700">Manufacturer</th>
            <th className="p-3 border-b border-gray-700">Vendor Id</th>
            <th className="p-3 border-b border-gray-700">Product Id</th>
            <th className="p-3 border-b border-gray-700">USB Serial No. Id</th>
            <th className="p-3 border-b border-gray-700">Type</th>
            <th className="p-3 border-b border-gray-700">Status</th>
            <th className="p-3 border-b border-gray-700">Assigned Officer Id</th>
            <th className="p-3 border-b border-gray-700">Assigned Officer Name</th>
            <th className="p-3 border-b border-gray-700">Camera Purchase Date</th>
            <th className="p-3 border-b border-gray-700">Assigned to Organization</th>
            <th className="p-3 border-b border-gray-700">Camera Assigner (UTO)</th>
            <th className="p-3 border-b border-gray-700">Assigned to Branch</th>
            <th className="p-3 border-b border-gray-700">Camera Assigner (OTB)</th>
            <th className="p-3 border-b border-gray-700">Assigned to Officer</th>
            <th className="p-3 border-b border-gray-700">Camera Assigner (BTO)</th>

            <th className="p-3 border-b border-gray-700">Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredCameras.length === 0 ? (
            <tr>
              <td colSpan={18} className="p-4 text-center text-gray-400">
                No cameras found.
              </td>
            </tr>
          ) : (
            filteredCameras.map((camera) => (
              <tr
                key={camera.camera_id}
                onClick={async () => {
                  setSelectedId(camera.camera_id);
                }}
                className={`border-b border-gray-700 cursor-pointer hover:bg-gray-800 ${
                  selectedId === camera.camera_id ? "bg-gray-900" : ""
                }`}
              >
                <td className="p-3">{camera.serial_number}</td>
                <td className="p-3">{camera.model}</td>
                <td className="p-3">{camera.manufacturer ?? "No Manufacturer"}</td>
                <td className="p-3">{camera.vendor_id ?? "No Vendor Id"}</td>
                <td className="p-3">{camera.product_id ?? "No Product Id"}</td>
                <td className="p-3">{camera.usb_serial ?? "No USB Serial Number"}</td>
                <td className="p-3">{camera.type}</td>

                <td className="p-3">
                  <span className={`px-3 py-1 ${getStatusBadge(camera.status)}`}>
                    {camera.status}
                  </span>
                </td>
                <td className="p-3">{camera.assigned_to || "NONE"}</td>
                
                <td className="p-3">
                    {camera.officer ? `${camera.officer.user.first_name} ${camera.officer.user.last_name}` : 'No Assigned Officer'}
                 </td>

                <td className="p-3">{camera.purchase_date ? new Date(camera.purchase_date).toLocaleDateString(): "N/A"}</td>
                <td className="p-3">{camera.assigned_to_org_at
                      ? `${new Date(camera.assigned_to_org_at).toDateString()},${new Date(camera.assigned_to_org_at).toLocaleTimeString()} `
                      : 'N/A'
                    }
                </td>
                <td className="p-3">
                  <UserName userId={camera.assigned_to_org_by}/>
                </td>

                <td className="p-3">{camera.assigned_to_branch_at
                      ? `${new Date(camera.assigned_to_branch_at).toDateString()},${new Date(camera.assigned_to_branch_at).toLocaleTimeString()} `
                      : 'N/A'
                    }
                </td>

                <td className="p-3">
                  <UserName userId={camera.assigned_to_branch_by}/>
                </td>

                <td className="p-3">{camera.assigned_to_officer_at
                      ? `${new Date(camera.assigned_to_officer_at).toDateString()},${new Date(camera.assigned_to_officer_at).toLocaleTimeString()} `
                      : 'N/A'
                    }
                </td>

                <td className="p-3">
                  <UserName userId={camera.assigned_to_officer_by}/>
                </td>
                <td className="p-3 flex gap-2">
                  {/* Only show Assign for UNASSIGNED tab */}
                  {type === "UNASSIGNED" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCamera(camera);
                      }}
                      className="underline hover:no-underline"
                    >
                      Assign
                    </button>
                  )}

                  {onUpdateCamera && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateCamera(camera);
                      }}
                      className="underline hover:no-underline"
                    >
                      Update
                    </button>
                  )}
                  
                  {onDeleteCamera && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCamera(camera);
                      }}
                      className="underline hover:no-underline"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}