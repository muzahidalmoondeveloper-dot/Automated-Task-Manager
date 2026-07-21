import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { reportApi } from "../api/reportApi";

export default function ReportPreviewPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();

  const [objectUrl, setObjectUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let url = null;
    let cancelled = false;

    async function loadPreview() {
      try {
        setIsLoading(true);
        setError("");
        const blob = await reportApi.fetchPdfBlob(reportId, { download: false });
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to generate PDF preview.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [reportId]);

  async function handleDownload() {
    try {
      const blob = await reportApi.fetchPdfBlob(reportId, { download: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `report-${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || "PDF download failed. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(`/reports/${reportId}/edit`)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Back to Edit
        </button>

        <button
          type="button"
          onClick={handleDownload}
          disabled={!objectUrl}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Download PDF
        </button>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Preparing report preview...
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-red-600">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => navigate(0)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        ) : (
          <iframe src={objectUrl} title="Report preview" className="h-full w-full border-0" />
        )}
      </div>
    </div>
  );
}
