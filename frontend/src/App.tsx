import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ICONS } from "./utils/icons";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { ImpactHUD } from "./components/ImpactHUD";
import type {
  SymbolNode,
  BlastReport,
  ProjectSample,
} from "./types/impact";
import {
  fetchSamples,
  scanWorkspace,
  calculateImpact,
} from "./services/api";

export const App: React.FC = () => {
  const [samples, setSamples] = useState<ProjectSample[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string>("sample_projects/csharp_ecommerce");
  const [symbols, setSymbols] = useState<SymbolNode[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolNode | null>(null);
  const [report, setReport] = useState<BlastReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"graph" | "sandbox" | "callers">("graph");

  // Load initial samples and workspace
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        const sampleList = await fetchSamples();
        setSamples(sampleList);

        const scanData = await scanWorkspace("sample_projects/csharp_ecommerce");
        setSymbols(scanData.symbols);

        // Auto-select UserService.GetUser as the premier demo symbol
        const defaultTarget = scanData.symbols.find((s) => s.id === "UserService.GetUser") || scanData.symbols[0];
        if (defaultTarget) {
          setSelectedSymbol(defaultTarget);
          const impactData = await calculateImpact(defaultTarget.id);
          setReport(impactData);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Handle symbol selection
  const handleSelectSymbol = async (sym: SymbolNode) => {
    setSelectedSymbol(sym);
    try {
      const impactData = await calculateImpact(sym.id);
      setReport(impactData);
    } catch (err) {
      console.error("Failed to load impact report:", err);
    }
  };

  // Switch workspace
  const handleSelectSample = async (sample: ProjectSample) => {
    setActiveWorkspace(sample.path);
    setIsScanning(true);
    try {
      const scanData = await scanWorkspace(sample.path);
      setSymbols(scanData.symbols);
      if (scanData.symbols.length > 0) {
        const firstSym = scanData.symbols[0];
        setSelectedSymbol(firstSym);
        const impactData = await calculateImpact(firstSym.id);
        setReport(impactData);
      } else {
        setSelectedSymbol(null);
        setReport(null);
      }
    } catch (err) {
      console.error("Failed to switch workspace:", err);
    } finally {
      setIsScanning(false);
    }
  };

  // Rescan active workspace
  const handleRescan = async () => {
    setIsScanning(true);
    try {
      const scanData = await scanWorkspace(activeWorkspace);
      setSymbols(scanData.symbols);
      if (selectedSymbol) {
        const impactData = await calculateImpact(selectedSymbol.id);
        setReport(impactData);
      }
    } catch (err) {
      console.error("Rescan failed:", err);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500/30 selection:text-rose-200">
      {/* Top Navigation */}
      <Navbar
        samples={samples}
        activeWorkspace={activeWorkspace}
        onSelectSample={handleSelectSample}
        onRescan={handleRescan}
        isScanning={isScanning}
        onOpenPRModal={() => {}}
        targetSymbolId={selectedSymbol?.id}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Symbol Tree */}
        <Sidebar
          symbols={symbols}
          selectedSymbolId={selectedSymbol?.id || null}
          onSelectSymbol={handleSelectSymbol}
          isLoading={isLoading}
        />

        {/* Center/Right Main Canvas */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950/40">
          {/* Blast Radius Impact HUD */}
          <ImpactHUD report={report} isLoading={isLoading} />

          {/* Sub Navigation Tabs */}
          <div className="flex items-center justify-between px-5 pt-3 border-b border-slate-800/80 bg-slate-950/50">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("graph")}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                  activeTab === "graph"
                    ? "border-rose-500 text-white bg-slate-900/60"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
              >
                <FontAwesomeIcon icon={ICONS.blastTarget} className="text-xs text-rose-400" />
                <span>Interactive Ripple Graph</span>
              </button>

              <button
                onClick={() => setActiveTab("sandbox")}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                  activeTab === "sandbox"
                    ? "border-cyan-500 text-white bg-slate-900/60"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
              >
                <FontAwesomeIcon icon={ICONS.simulate} className="text-xs text-cyan-400" />
                <span>"What-If" Code Sandbox</span>
              </button>

              <button
                onClick={() => setActiveTab("callers")}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                  activeTab === "callers"
                    ? "border-purple-500 text-white bg-slate-900/60"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
              >
                <FontAwesomeIcon icon={ICONS.controller} className="text-xs text-purple-400" />
                <span>Impacted Callers List</span>
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-500 hidden sm:flex items-center gap-2">
              <FontAwesomeIcon icon={ICONS.dot} className="text-emerald-400 text-[8px] animate-ping" />
              <span>AST Call Graph Active</span>
            </div>
          </div>

          {/* Active Tab Content Area */}
          <div className="flex-1 overflow-auto p-5 relative">
            {activeTab === "graph" && (
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl p-8 text-center bg-slate-900/20">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-2xl mb-4 blast-ripple">
                  <FontAwesomeIcon icon={ICONS.blastTarget} />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  Graph Canvas Ready for Phase 6
                </h3>
                <p className="text-xs text-slate-400 max-w-md mb-4">
                  Currently targeting <strong className="text-white font-mono">{selectedSymbol?.id || "None"}</strong>.
                  In Phase 6, this canvas renders the force-directed call graph with animated SVG energy ripples.
                </p>
                {report && (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
                    <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {report.summary.total_dependents} Callers
                    </span>
                    <span className="px-2.5 py-1 rounded bg-purple-950/40 border border-purple-800/40 text-purple-300">
                      {report.summary.controllers_count} Controllers
                    </span>
                    <span className="px-2.5 py-1 rounded bg-amber-950/40 border border-amber-800/40 text-amber-300">
                      {report.summary.db_ops_count} Database Ops
                    </span>
                    <span className="px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
                      {report.summary.tests_count} Tests
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeTab === "sandbox" && (
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl p-8 text-center bg-slate-900/20">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-2xl mb-4">
                  <FontAwesomeIcon icon={ICONS.code} />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  Monaco "What-If" Sandbox Ready for Phase 7
                </h3>
                <p className="text-xs text-slate-400 max-w-md">
                  In Phase 7, you will be able to alter function parameters live in Monaco Editor and watch compiler-grade breaking change diagnostics update in real-time.
                </p>
              </div>
            )}

            {activeTab === "callers" && report && (
              <div className="space-y-4 max-w-4xl mx-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 m-0">
                    Upstream Dependent Callers ({report.affected_nodes.length})
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    Ranked by Blast Radius
                  </span>
                </div>

                <div className="grid gap-2">
                  {report.affected_nodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 text-xs">
                          <FontAwesomeIcon
                            icon={node.symbol_type === "controller" ? ICONS.controller : ICONS.service}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white font-mono">{node.id}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {node.file_path}:{node.line_number}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {node.http_method && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700/50">
                            {node.http_method} ENDPOINT
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded">
                          {node.calls.length} Invocations
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
