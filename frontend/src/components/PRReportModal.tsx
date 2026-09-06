import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ICONS } from "../utils/icons";
import type { BlastReport } from "../types/impact";
import { exportPRReport } from "../services/api";

interface PRReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbolId: string | null;
  report: BlastReport | null;
}

export const PRReportModal: React.FC<PRReportModalProps> = ({
  isOpen,
  onClose,
  symbolId,
  report,
}) => {
  const [prTitle, setPrTitle] = useState(
    symbolId ? `refactor: update ${symbolId} contract` : "Feature / Refactoring Update"
  );
  const [markdown, setMarkdown] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");

  // Sync title when active symbol changes or modal opens
  useEffect(() => {
    if (symbolId) {
      setPrTitle(`refactor: update ${symbolId} contract`);
    }
  }, [symbolId, isOpen]);

  // Debounced report loading to prevent excessive server requests while typing
  useEffect(() => {
    if (isOpen && symbolId) {
      const handler = setTimeout(async () => {
        setIsLoading(true);
        try {
          const res = await exportPRReport(symbolId, prTitle);
          setMarkdown(res.markdown);
        } catch (err) {
          console.error("Failed to generate PR report:", err);
        } finally {
          setIsLoading(false);
        }
      }, 300);

      return () => clearTimeout(handler);
    }
  }, [isOpen, symbolId, prTitle]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codeimpact-report-${report.target_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <FontAwesomeIcon icon={ICONS.pr} className="text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white m-0">
                GitHub PR Blast Radius Card
              </h3>
              <p className="text-[11px] text-slate-400 m-0">
                Generate formatted markdown comments for GitHub pull requests
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            &times;
          </button>
        </div>

        {/* PR Title Input & Controls */}
        <div className="p-4 border-b border-slate-800/60 bg-slate-900/30 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex-1 min-w-[240px]">
            <label className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider block mb-1">
              Pull Request Title
            </label>
            <input
              type="text"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 self-end">
            <button
              onClick={() => setViewMode("preview")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "preview"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setViewMode("raw")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "raw"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Raw Markdown
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <FontAwesomeIcon icon={ICONS.refresh} className="animate-spin text-cyan-400 text-2xl" />
              <span>Generating GitHub PR Card...</span>
            </div>
          ) : viewMode === "preview" ? (
            <div className="space-y-4 text-xs font-sans text-slate-300 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
              {/* Header Badge */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🛡️ CodeImpact — Blast Radius Report</span>
                  </div>
                  <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                    Target: <strong className="text-white">{report?.target_id}</strong> ({report?.target_file})
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Risk Score</span>
                  <span className="text-sm font-black text-rose-400 font-mono">
                    {report?.blast_score} / 100 [{report?.severity}]
                  </span>
                </div>
              </div>

              {/* KPI Summary Table */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                  Impact Breakdown
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <div className="text-base font-bold text-white font-mono">{report?.summary.total_dependents}</div>
                    <div className="text-[10px] text-slate-500">Dependent Callers</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <div className="text-base font-bold text-purple-400 font-mono">{report?.summary.controllers_count}</div>
                    <div className="text-[10px] text-slate-500">HTTP Endpoints</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <div className="text-base font-bold text-amber-400 font-mono">{report?.summary.db_ops_count}</div>
                    <div className="text-[10px] text-slate-500">Database Ops</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <div className="text-base font-bold text-emerald-400 font-mono">{report?.summary.tests_count}</div>
                    <div className="text-[10px] text-slate-500">Tests Covering</div>
                  </div>
                </div>
              </div>

              {/* Affected Endpoints */}
              {report?.affected_controllers && report.affected_controllers.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    🌐 Exposed Public API Endpoints
                  </div>
                  <div className="space-y-1">
                    {report.affected_controllers.map((c) => (
                      <div key={c.id} className="text-[11px] font-mono p-1.5 bg-slate-950 rounded border border-slate-800/80 flex items-center justify-between">
                        <span className="text-purple-300">{c.id}</span>
                        <span className="text-slate-500">{c.http_method || "ROUTE"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Untested Danger Alert */}
              {report?.untested_paths && report.untested_paths.length > 0 && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-400 text-xs">
                    <FontAwesomeIcon icon={ICONS.danger} />
                    <span>Untested Danger Zone Alert</span>
                  </div>
                  <p className="text-[11px] text-rose-200/80 m-0">
                    {report.untested_paths.length} affected upstream callers lack unit test coverage.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <textarea
              readOnly
              value={markdown}
              className="w-full h-72 p-3 bg-slate-900 font-mono text-[11px] text-slate-300 border border-slate-800 rounded-xl focus:outline-none resize-none leading-relaxed"
            />
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between flex-shrink-0">
          <button
            onClick={handleDownloadJSON}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
          >
            <FontAwesomeIcon icon={ICONS.model} className="text-xs" />
            <span>Download JSON Audit</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              Close
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white shadow-lg shadow-rose-500/20 transition-all cursor-pointer"
            >
              <FontAwesomeIcon icon={isCopied ? ICONS.copied : ICONS.copy} className="text-xs" />
              <span>{isCopied ? "Copied to Clipboard!" : "Copy Markdown for PR"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
