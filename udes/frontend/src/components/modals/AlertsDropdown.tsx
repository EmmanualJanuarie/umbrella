import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import type { Notification } from "../../data/types";
import toast, { Toaster } from "react-hot-toast";

export default function AlertsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastUnreadRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

  const toggleDropdown = () => setOpen(!open);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/notifications/poll`, { withCredentials: true });
      const latestNotifications: Notification[] = res.data.latest || [];
      const latestUnread = res.data.unreadCount || 0;

      if (hasLoadedRef.current && latestUnread > lastUnreadRef.current) {
        const newCount = latestUnread - lastUnreadRef.current;
        toast.success(
          `${newCount} new notification${newCount === 1 ? "" : "s"}`,
        );
      }

      setNotifications(latestNotifications);
      setUnreadCount(latestUnread);
      lastUnreadRef.current = latestUnread;
      hasLoadedRef.current = true;
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, [API_URL]);

  // Fetch notifications & update counter
  useEffect(() => {
    void fetchNotifications();

    const interval = window.setInterval(() => void fetchNotifications(), 15000);
    const refreshOnFocus = () => void fetchNotifications();
    const refreshOnVisibility = () => {
      if (!document.hidden) void fetchNotifications();
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));

      await axios.patch(`${API_URL}/notifications/${id}/read`, {}, { withCredentials: true });
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const isUnread = notifications.find((n) => n.notification_id === id && !n.is_read);

      setNotifications((prev) => prev.filter((n) => n.notification_id !== id));
      if (isUnread) setUnreadCount((prev) => Math.max(prev - 1, 0));

      await axios.delete(`${API_URL}/notifications/${id}`, { withCredentials: true });
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    await markAsRead(n.notification_id);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Toaster position="top-right" reverseOrder={false} />

      {/* Button with badge */}
      <button
        onClick={toggleDropdown}
        className="px-4 py-2 text-white border focus:outline-none relative"
      >
        Alerts ({unreadCount})
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white shadow-lg z-50 max-h-80 overflow-y-auto">
          <ul className="flex flex-col text-gray-800">
            {notifications.length === 0 && <li className="px-4 py-2">No alerts yet</li>}

            {notifications.map((n) => (
              <li
                key={n.notification_id}
                onClick={() => handleNotificationClick(n)}
                className={`px-4 py-2 cursor-pointer border-b hover:bg-gray-100 ${
                  !n.is_read ? "bg-gray-50 font-semibold" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-bold">{n.title}</span>
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-red-600"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteNotification(n.notification_id);
                    }}
                    aria-label="Delete notification"
                  >
                    Delete
                  </button>
                </div>
                <p className="text-sm">{n.message}</p>
                <span className="text-xs text-gray-500">
                  {n.created_at
                    ? `${new Date(n.created_at).toLocaleString()}`
                    : "No Timestamp"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
