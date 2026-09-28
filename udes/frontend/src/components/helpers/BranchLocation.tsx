import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

interface BranchLocationProps {
  branchId?: string | null;
}

export const BranchLocation = ({ branchId }: BranchLocationProps) => {
  const [location, setLocation] = useState("No Location");

  useEffect(() => {
    if (!branchId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocation("N/A");
      return;
    }

    axios
      .get(`${API_URL}/branches/${branchId}/location`, {
        withCredentials: true,
      })
      .then((res) => {
        const { location } = res.data;
        setLocation(`${location}`);
      })
      .catch(() => {
        setLocation("Unknown Branch");
      });
  }, [branchId]);

  return <span>{location}</span>;
};