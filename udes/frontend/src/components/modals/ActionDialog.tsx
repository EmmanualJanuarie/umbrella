import { useCallback, useState } from "react";

type DialogMode = "message" | "confirm" | "prompt";
type DialogTone = "danger" | "info" | "success";

type DialogRequest = {
  mode: DialogMode;
  tone: DialogTone;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  placeholder?: string;
  required?: boolean;
  resolve: (value: boolean | string | null) => void;
};

type DialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  placeholder?: string;
  required?: boolean;
};

export function useActionDialog() {
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState("");

  const openDialog = useCallback(
    (request: Omit<DialogRequest, "resolve">) =>
      new Promise<boolean | string | null>((resolve) => {
        setValue("");
        setDialog({ ...request, resolve });
      }),
    [],
  );

  const showMessage = useCallback(
    async (options: DialogOptions) => {
      await openDialog({
        mode: "message",
        tone: options.tone ?? "info",
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "OK",
      });
    },
    [openDialog],
  );

  const confirmAction = useCallback(
    async (options: DialogOptions) => {
      const result = await openDialog({
        mode: "confirm",
        tone: options.tone ?? "danger",
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Confirm",
        cancelLabel: options.cancelLabel ?? "Cancel",
      });
      return result === true;
    },
    [openDialog],
  );

  const promptAction = useCallback(
    async (options: DialogOptions) => {
      const result = await openDialog({
        mode: "prompt",
        tone: options.tone ?? "info",
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Submit",
        cancelLabel: options.cancelLabel ?? "Cancel",
        placeholder: options.placeholder,
        required: options.required,
      });
      return typeof result === "string" ? result : null;
    },
    [openDialog],
  );

  const close = (result: boolean | string | null) => {
    dialog?.resolve(result);
    setDialog(null);
    setValue("");
  };

  const dialogElement = dialog ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden border border-white/10 bg-gray-950 text-white shadow-2xl">
        <div className="border-b border-white/10 bg-black/35 px-6 py-5">
          <p className={`text-xs uppercase tracking-[0.18em] ${
            dialog.tone === "danger"
              ? "text-red-300"
              : dialog.tone === "success"
                ? "text-green-300"
                : "text-white/45"
          }`}>
            Umbrella Systems
          </p>
          <h2 className="mt-1 text-xl font-semibold">{dialog.title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/65">{dialog.message}</p>
        </div>

        {dialog.mode === "prompt" && (
          <div className="p-6">
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={dialog.placeholder}
              className="min-h-32 w-full resize-none border border-white/10 bg-black/35 p-3 text-sm text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              autoFocus
            />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 bg-gray-950/95 px-6 py-4">
          {dialog.mode !== "message" && (
            <button
              type="button"
              onClick={() => close(null)}
              className="border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
            >
              {dialog.cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => close(dialog.mode === "prompt" ? value.trim() : true)}
            disabled={dialog.mode === "prompt" && dialog.required && !value.trim()}
            className={`px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-700 ${
              dialog.tone === "danger"
                ? "bg-red-600 hover:bg-red-500"
                : dialog.tone === "success"
                  ? "bg-green-700 hover:bg-green-600"
                  : "bg-red-600 hover:bg-red-500"
            }`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return {
    dialogElement,
    showMessage,
    confirmAction,
    promptAction,
  };
}
