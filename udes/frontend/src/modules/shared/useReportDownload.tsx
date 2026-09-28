import axios from "axios";
import { api } from "../../api/axios";

type DownloadRequest = {
  url: string;
  fileName: string;
  title: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
};

async function errorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return "The report could not be downloaded.";
  const data = error.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string | string[] };
      return Array.isArray(parsed.message)
        ? parsed.message.join(", ")
        : parsed.message ?? "The report could not be downloaded.";
    } catch {
      return "The report could not be downloaded.";
    }
  }
  const message = data?.message;
  return Array.isArray(message)
    ? message.join(", ")
    : message ?? "The report could not be downloaded.";
}

export function useReportDownload() {
  const requestDownload = async (request: DownloadRequest) => {
    try {
      const response =
        request.method === "POST"
          ? await api.post(
              request.url,
              request.body ?? {},
              { responseType: "blob" },
            )
          : await api.get(request.url, {
              responseType: "blob",
            });
      const objectUrl = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = request.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 30_000);
    } catch (downloadError) {
      window.alert(await errorMessage(downloadError));
    }
  };

  return { requestDownload, dialogElement: null };
}
