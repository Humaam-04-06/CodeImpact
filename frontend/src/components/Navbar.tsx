import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ICONS } from "../utils/icons";
import type { ProjectSample } from "../types/impact";

interface NavbarProps {
  samples: ProjectSample[];
  activeWorkspace: string;
  activeProjectId?: string;
  onSelectSample: (sample: ProjectSample) => void;
  onRescan: () => void;
  isScanning: boolean;
  onOpenPRModal: () => void;
  onOpenUploadModal: () => void;
  targetSymbolId?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  samples,
  activeWorkspace,
  activeProjectId,
  onSelectSample,
  onRescan,
  isScanning,
  onOpenPRModal,
  onOpenUploadModal,
  targetSymbolId,
}) => {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-5 flex items-center justify-between z-30 sticky top-0">
      {/* Brand Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 via-purple-600 to-cyan-500 p-[1px] shadow-lg shadow-rose-500/20">
          <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
            <FontAwesomeIcon icon={ICONS.blastTarget} className="text-rose-400 text-lg animate-pulse" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white m-0">CodeImpact</h1>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono hidden sm:block m-0">
            Dependency &amp; Blast Radius Analyzer
          </p>
        </div>
      </div>

      {/* Center Controls: Project Workspace Selector */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
          <FontAwesomeIcon icon={ICONS.tree} className="text-slate-400 text-xs" />
          <span className="text-slate-500">Project:</span>
          <select
            value={
              activeProjectId ||
              samples.find(
                (s) =>
                  s.path.replace(/\\/g, "/").toLowerCase() ===
                  activeWorkspace.replace(/\\/g, "/").toLowerCase()
              )?.id ||
              samples[0]?.id ||
              ""
            }
            onChange={(e) => {
              const selected = samples.find(
                (s) => s.id === e.target.value || s.path === e.target.value
              );
              if (selected) onSelectSample(selected);
            }}
            className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
          >
            {samples.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                {s.name} ({s.language})
              </option>
            ))}
          </select>
        </div>

        {/* Upload Project Button */}
        <button
          onClick={onOpenUploadModal}
          title="Upload Project ZIP or Scan Local Directory"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600/90 to-blue-600/90 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-500/30 shadow-md shadow-cyan-500/10 transition-all cursor-pointer"
        >
          <FontAwesomeIcon icon={ICONS.upload} className="text-xs" />
          <span className="hidden sm:inline">Upload Project</span>
        </button>

        {/* Rescan Button */}
        <button
          onClick={onRescan}
          disabled={isScanning}
          title="Rescan Workspace AST"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-all hover:border-slate-700 disabled:opacity-50"
        >
          <FontAwesomeIcon
            icon={ICONS.refresh}
            className={`text-slate-400 text-xs ${isScanning ? "animate-spin text-cyan-400" : ""}`}
          />
          <span className="hidden sm:inline">{isScanning ? "Analyzing..." : "Rescan"}</span>
        </button>
      </div>

      {/* Right Actions: PR Card Trigger & GitHub link */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenPRModal}
          disabled={!targetSymbolId}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white shadow-md shadow-rose-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon icon={ICONS.pr} className="text-xs" />
          <span className="hidden sm:inline">Export PR Card</span>
        </button>

        <a
          href="https://github.com/Humaam-04-06/CodeImpact"
          target="_blank"
          rel="noreferrer"
          className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          title="GitHub Repository"
        >
          <FontAwesomeIcon icon={ICONS.code} className="text-xs" />
        </a>
      </div>
    </header>
  );
};
