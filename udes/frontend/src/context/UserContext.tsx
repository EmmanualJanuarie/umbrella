import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from "react";
import { getSession, type AuthSessionUser } from "../auth/auth.service";
import { clearRememberedDashboardPanes } from "../hooks/useRememberedDashboardPane";

export interface UserContextType {
  user: AuthSessionUser | null;
  loading: boolean;
  sessionError: boolean;
  setUser: (user: UserContextType["user"]) => void;
  refreshUser: (options?: { force?: boolean }) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

type Props = { children: ReactNode };

export const UserProvider = ({ children }: Props) => {
  const [user, setUser] = useState<UserContextType["user"]>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const userRef = useRef<UserContextType["user"]>(null);

  const setCurrentUser = useCallback((nextUser: UserContextType["user"]) => {
    if (!nextUser && userRef.current) {
      clearRememberedDashboardPanes(userRef.current.user_id);
    }
    userRef.current = nextUser;
    setUser(nextUser);
  }, []);

  const refreshUser = useCallback(async (options: { force?: boolean } = {}) => {
    try {
      const session = await getSession({ force: options.force });
      setSessionError(false);
      setCurrentUser(session.authenticated ? session.user : null);
    } catch (err) {
      console.error("Failed to fetch user", err);
      setSessionError(true);
    }
  }, [setCurrentUser]);

  // Fetch user on mount safely
  useEffect(() => {
    let mounted = true;

    const verify = async (options: { force?: boolean; showLoading?: boolean } = {}) => {
      if (options.showLoading) setLoading(true);
      try {
        const session = await getSession({ force: options.force });
        if (mounted) setSessionError(false);
        if (mounted) setCurrentUser(session.authenticated ? session.user : null);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        // Keep the current dashboard session during transient backend/network failures.
        if (mounted) setSessionError(true);
      } finally {
        if (mounted && options.showLoading) setLoading(false);
      }
    };

    void verify({ force: true, showLoading: true });

    const refreshQuietly = () => {
      void verify();
    };
    const refreshOnVisibility = () => {
      if (!document.hidden) void verify({ force: true });
    };

    const interval = window.setInterval(refreshQuietly, 5 * 60 * 1000);
    const clearExpiredSession = async () => {
      if (!mounted) return;

      setLoading(true);
      try {
        const session = await getSession({ force: true });
        if (!mounted) return;
        setSessionError(false);
        setCurrentUser(session.authenticated ? session.user : null);
      } catch {
        // A failed verification request is not proof that the session expired.
        // Keep the current user and let the next refresh/focus check try again.
        if (mounted) setSessionError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    window.addEventListener("focus", refreshQuietly);
    window.addEventListener("umbrella:auth-expired", clearExpiredSession);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshQuietly);
      window.removeEventListener("umbrella:auth-expired", clearExpiredSession);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [setCurrentUser]);

  return (
    <UserContext.Provider value={{ user, loading, sessionError, setUser: setCurrentUser, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
};

// Hook to access user context
// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
};
