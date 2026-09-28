import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const branchNameCache = new Map<string, string>();
const pendingBranchNameRequests = new Map<string, Promise<string>>();

interface BranchNameProps {
  branchId?: string | null;
}

export const BranchName = ({ branchId }: BranchNameProps) => {
  const [name, setName] = useState(() =>
    branchId ? branchNameCache.get(branchId) ?? "Loading..." : "N/A",
  );

  useEffect(() => {
    let active = true;

    if (!branchId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName("N/A");
      return undefined;
    }

    const cached = branchNameCache.get(branchId);
    if (cached) {
      setName(cached);
      return undefined;
    }

    setName("Loading...");

    const request =
      pendingBranchNameRequests.get(branchId) ??
      axios
        .get(`${API_URL}/branches/${branchId}/name`, {
          withCredentials: true,
          timeout: 10000,
        })
        .then((res) => String(res.data?.name ?? "Unknown Branch"))
        .finally(() => {
          pendingBranchNameRequests.delete(branchId);
        });

    pendingBranchNameRequests.set(branchId, request);

    request
      .then((resolvedName) => {
        branchNameCache.set(branchId, resolvedName);
        if (active) setName(resolvedName);
      })
      .catch(() => {
        if (active) setName("Unknown Branch");
      });

    return () => {
      active = false;
    };
  }, [branchId]);

  return <span>{name}</span>;
};
