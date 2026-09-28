import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
type UserIdentity = { name: string; role?: string };
const userNameCache = new Map<string, UserIdentity>();
const pendingUserNameRequests = new Map<string, Promise<UserIdentity>>();

interface UserNameProps {
  userId?: string | null;
  showRole?: boolean;
}

export const UserName = ({ userId, showRole = false }: UserNameProps) => {
  const [identity, setIdentity] = useState<UserIdentity>(() =>
    userId ? userNameCache.get(userId) ?? { name: "Loading..." } : { name: "No Username" },
  );

  useEffect(() => {
    let active = true;

    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIdentity({ name: "No Username" });
      return undefined;
    }

    const cached = userNameCache.get(userId);
    if (cached) {
      setIdentity(cached);
      return undefined;
    }

    setIdentity({ name: "Loading..." });

    const request =
      pendingUserNameRequests.get(userId) ??
      axios
        .get(`${API_URL}/user/${userId}/name`, {
          withCredentials: true,
          timeout: 10000,
        })
        .then((res) => {
          const firstName = String(res.data?.first_name ?? "").trim();
          const lastName = String(res.data?.last_name ?? "").trim();
          return {
            name: `${firstName} ${lastName}`.trim() || "Unknown User",
            role: typeof res.data?.role === "string" ? res.data.role : undefined,
          };
        })
        .finally(() => {
          pendingUserNameRequests.delete(userId);
        });

    pendingUserNameRequests.set(userId, request);

    request
      .then((resolvedIdentity) => {
        userNameCache.set(userId, resolvedIdentity);
        if (active) setIdentity(resolvedIdentity);
      })
      .catch(() => {
        if (active) setIdentity({ name: "Unknown User" });
      });

    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <span>
      {identity.name}
      {showRole && identity.role ? ` (${identity.role.replaceAll("_", " ")})` : ""}
    </span>
  );
};
