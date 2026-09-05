import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ICONS } from "../utils/icons";
import type { BlastReport } from "../types/impact";

interface ImpactHUDProps {
  report: BlastReport | null;
  isLoading: boolean;
}

export const ImpactHUD: React.FC<ImpactHUDProps> = ({ report, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-4 bg-slate-900/50 border-b border-slate-800/80 animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800" />
          <div className="space-y-1">
            <div className="w-40 h-3 bg-slate-800 rounded" />
            <div className="w-24 h-2 bg-slate-800 rounded" />
          </div>
        </div>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-28 h-12 bg-slate-800/60 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-4 bg-slate-900/30 border-b border-slate-800/60 text-slate-500 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={ICONS.blastTarget} className="text-slate-600 text-sm" />
          <span>Select any function from the left sidebar to analyze its blast radius and breaking impact.</span>
        </div>
      </div>
    );
  }

  const { summary, blast_score, severity, target_id, target_file } = report;

  const severityConfig = {
    CRITICAL: {
      color: "text-rose-400 border-rose-500/40 bg-rose-950/30",
      badge: "bg-rose-500 text-white",
      progress: "bg-rose-500",
    },
    HIGH: {
      color: "text-orange-400 border-orange-500/40 bg-orange-950/30",
      badge: "bg-orange-500 text-white",
      progress: "bg-orange-500",
    },
    MEDIUM: {
      color: "text-amber-400 border-amber-500/40 bg-amber-950/30",
      badge: "bg-amber-500 text-black font-semibold",
      progress: "bg-amber-500",
    },
    LOW: {
      color: "text-emerald-400 border-emerald-500/40 bg-emerald-950/30",
      badge: "bg-emerald-500 text-black font-semibold",
      progress: "bg-emerald-500",
    },
  }[severity];

  return (
    <div className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md p-4 space-y-3">
      {/* Target Info Bar & Score Gauge */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Target Symbol Summary */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
            <FontAwesomeIcon icon={ICONS.blastTarget} className="text-rose-400 text-base" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Target Changed:</span>
              <span className="text-sm font-bold text-white font-mono">{target_id}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${severityConfig.badge}`}>
                {severity} RISK
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono m-0">{target_file}</p>
          </div>
        </div>

        {/* Risk Score Progress Bar */}
        <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Blast Radius Score</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white font-mono">{blast_score}</span>
              <span className="text-xs text-slate-500 font-mono">/ 100</span>
            </div>
          </div>

          <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${severityConfig.progress}`}
              style={{ width: `${blast_score}%` }}
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* 1. Dependent Functions */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <FontAwesomeIcon icon={ICONS.service} className="text-sm" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Dependent Functions</div>
            <div className="text-base font-bold text-white font-mono">{summary.total_dependents}</div>
          </div>
        </div>

        {/* 2. HTTP Controllers */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-950/50 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
            <FontAwesomeIcon icon={ICONS.controller} className="text-sm" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">HTTP Endpoints</div>
            <div className="text-base font-bold text-white font-mono">{summary.controllers_count}</div>
          </div>
        </div>

        {/* 3. Database Operations */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-950/50 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
            <FontAwesomeIcon icon={ICONS.repository} className="text-sm" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Database Queries</div>
            <div className="text-base font-bold text-white font-mono">{summary.db_ops_count}</div>
          </div>
        </div>

        {/* 4. Unit Tests */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <FontAwesomeIcon icon={ICONS.test} className="text-sm" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Tests Covering</div>
            <div className="text-base font-bold text-white font-mono">{summary.tests_count}</div>
          </div>
        </div>

        {/* 5. Untested Danger Zone */}
        <div className={`border rounded-xl p-2.5 flex items-center gap-3 ${
          summary.untested_paths_count > 0
            ? "bg-rose-950/30 border-rose-500/40 text-rose-300"
            : "bg-slate-900/60 border-slate-800/80 text-slate-400"
        }`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${
            summary.untested_paths_count > 0
              ? "bg-rose-900/60 border-rose-500/50 text-rose-400"
              : "bg-slate-800/60 border-slate-700/50 text-slate-400"
          }`}>
            <FontAwesomeIcon icon={ICONS.danger} className="text-sm" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider">Untested Danger</div>
            <div className="text-base font-bold font-mono">{summary.untested_paths_count} Paths</div>
          </div>
        </div>
      </div>
    </div>
  );
};
