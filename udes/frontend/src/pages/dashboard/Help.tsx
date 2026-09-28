/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, type JSX } from "react";
import toast, { Toaster } from "react-hot-toast";
import { api } from "../../api/axios";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type FAQ = {
  question: string;
  answer: string | JSX.Element;
};

const faqs: FAQ[] = [
  {
    question: "How do I reset my password?",
    answer: "Use the password change request form below to request a password reset.",
  },
  {
    question: "Who can approve my password request?",
    answer: "Password change requests are handled by authorized administrative personnel.",
  },
  {
    question: "How long does a request take?",
    answer: "Requests are typically processed within 24 hours.",
  },
  {
    question: "What happens if my request is denied?",
    answer:
      "You will receive an email outlining the reason for the denial. You may contact your branch or organization for further clarification.",
  },
  {
    question: "How is my data secured?",
    answer:
      "All communication is encrypted. Passwords are never stored in plain text, and all user activity is logged for auditing purposes.",
  },
  {
    question: "How can I contact support if I encounter an issue?",
    answer: (
      <span>
        For technical issues unrelated to password changes, please contact our
        support team at <u>support@umbrellasystems.co.za</u>
      </span>
    ),
  },
];

const reasonOptions = [
  "Forgot password",
  "Account locked",
  "Security concern",
  "Suspected unauthorized access",
  "System access issue",
  "Other",
];

export default function HelpPage() {
  useDocumentTitle("Help and Support");
  const [requestNote, setRequestNote] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isTooWide, setIsTooWide] = useState(false);
  const [customReason, setCustomReason] = useState("");

  // Screen rules
  useEffect(() => {
    const checkScreen = () => {
      const width = window.innerWidth;
      setIsDesktop(width >= 1024);
      setIsTooWide(width > 1920);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // Email validation
  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Form validation (for button disable)
  const isFormValid =
    email.trim() &&
    isValidEmail(email) &&
    requestNote &&
    (requestNote !== "Other" || customReason.trim());

  const submitRequest = async () => {
    if (submitting) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!requestNote) {
      toast.error("Please select a reason");
      return;
    }

    if (requestNote === "Other" && !customReason.trim()) {
      toast.error("Please enter your custom reason");
      return;
    }

    const finalReason =
      requestNote === "Other" ? customReason : requestNote;

    setSubmitting(true);

    try {
      await api.post(
        "/password-change-request/email",
        {
          requester_note: finalReason,
          email: normalizedEmail,
        },
        { timeout: 15000 }
      );

      toast.success("Password change request submitted!");

      // Reset form
      setRequestNote("");
      setCustomReason("");
      setEmail("");

    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.code === "ECONNABORTED"
          ? "The request timed out. Please check the backend connection and try again."
          : err?.response?.data?.message || "Failed to submit request"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-body-black px-8 py-10 text-color-white">
      <Toaster position="top-right" reverseOrder={false} />

      {isTooWide ? (
        <p className="mx-auto max-w-3xl text-center text-lg font-bold">
          Your screen is too wide for the Digital Evidence System portal.
          <br />
          Please reduce the width to an appropriate size.
        </p>
      ) : !isDesktop ? (
        <p className="mx-auto max-w-3xl text-center text-lg font-bold">
          Sorry, the Digital Evidence System portal is only available on laptops and desktops.
          <br />
          Please access it from a larger screen.
        </p>
      ) : (
        <main className="mx-auto grid max-w-6xl grid-cols-[0.85fr_1.15fr] gap-8">
          <section className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-red-500">
                Support Center
              </p>
              <h1 className="mt-2 text-3xl font-extrabold">
                Help & Support
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Request account assistance and review common support guidance for the Digital Evidence System.
              </p>
            </div>

            <div className="border border-white/10 bg-white/[0.035] p-5">
              <h2 className="text-lg font-bold">Support Channels</h2>
              <div className="mt-5 space-y-4 text-sm">
                <div className="border-l-2 border-red-600 pl-4">
                  <p className="font-semibold text-white">Password Access</p>
                  <p className="mt-1 text-white/60">Submit a password change request for administrator review.</p>
                </div>
                <div className="border-l-2 border-white/15 pl-4">
                  <p className="font-semibold text-white">Technical Support</p>
                  <p className="mt-1 text-white/60">support@umbrellasystems.co.za</p>
                </div>
                <div className="border-l-2 border-white/15 pl-4">
                  <p className="font-semibold text-white">Review Window</p>
                  <p className="mt-1 text-white/60">Most access requests are reviewed within 24 hours.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="border border-white/10 bg-gradient-to-b from-white/[0.045] to-black/25 p-6 shadow-2xl shadow-black/30">
              <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-bold">Request a Password Change</h2>
                  <p className="mt-2 text-sm text-white/60">
                    Use your registered email address and provide the reason for the request.
                  </p>
                </div>
                <span className="border border-red-500/40 bg-red-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-normal text-red-300">
                  Account
                </span>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-semibold text-white/80">
                  Email Address
                  <input
                    type="email"
                    className="h-12 w-full border border-white/15 bg-black/40 px-4 text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-white/80">
                  Reason
                  <select
                    className="h-12 w-full border border-white/15 bg-black/40 px-4 text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
                    value={requestNote}
                    onChange={(e) => {
                      setRequestNote(e.target.value);
                      if (e.target.value !== "Other") setCustomReason("");
                    }}
                  >
                    <option value="">Select a reason</option>
                    {reasonOptions.map((reason, idx) => (
                      <option key={idx} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </label>

                {requestNote === "Other" && (
                  <label className="grid gap-2 text-sm font-semibold text-white/80">
                    Custom Reason
                    <textarea
                      className="min-h-28 w-full resize-none border border-white/15 bg-black/40 p-4 text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
                      placeholder="Enter your custom reason..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      rows={4}
                    />
                  </label>
                )}

                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="text-xs text-white/45">
                    Requests are audit logged and routed to authorized administrators.
                  </p>
                  <button
                    onClick={submitRequest}
                    disabled={submitting || !isFormValid}
                    className="min-w-36 bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </div>
            </div>

            <div className="border border-white/10 bg-white/[0.035] p-6">
              <h2 className="border-b border-white/10 pb-4 text-xl font-bold">
                Frequently Asked Questions
              </h2>

              <div className="mt-4 divide-y divide-white/10">
                {faqs.map((faq, idx) => {
                  const isOpen = openFAQ === idx;

                  return (
                    <div key={idx}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 py-4 text-left"
                        onClick={() => setOpenFAQ(isOpen ? null : idx)}
                      >
                        <span className="font-semibold text-white">{faq.question}</span>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/10 bg-black/35 text-lg font-bold text-red-500">
                          {isOpen ? "-" : "+"}
                        </span>
                      </button>

                      <div
                        className={`overflow-hidden transition-all duration-300 ${
                          isOpen ? "max-h-48 pb-4 opacity-100" : "max-h-0 opacity-0"
                        }`}
                      >
                        <p className="text-sm leading-6 text-white/62">{faq.answer}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
