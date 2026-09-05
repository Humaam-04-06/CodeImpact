import React, { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ICONS } from "./utils/icons";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { ImpactHUD } from "./components/ImpactHUD";
import { GraphView } from "./components/GraphView";
import { CodeSandbox } from "./components/CodeSandbox";
import { PRReportModal } from "./components/PRReportModal";
import { UploadProjectModal } from "./components/UploadProjectModal";
import type {
  SymbolNode,
  BlastReport,
  ProjectSample,
} from "./types/impact";
import {
  fetchSamples,
  scanWorkspace,
  calculateImpact,
  fetchGraphData,
} from "./services/api";

export const App: React.FC = () => {
  const [samples, setSamples] = useState<ProjectSample[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string>("sample_projects/csharp_ecommerce");
  const [symbols, setSymbols] = useState<SymbolNode[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolNode | null>(null);
  const [report, setReport] = useState<BlastReport | null>(null);
  const [graphNodes, setGraphNodes] = useState<any[]>([]);
  const [graphEdges, setGraphEdges] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGraphLoading, setIsGraphLoading] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"graph" | "sandbox" | "callers">("graph");
  const [isPRModalOpen, setIsPRModalOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  // Fetch graph data from backend
  const refreshGraph = useCallback(async (targetId?: string) => {
    try {
      setIsGraphLoading(true);
      const graphData = await fetchGraphData(targetId);
      setGraphNodes(graphData.nodes);
      setGraphEdges(graphData.edges);
    } catch (err) {
      console.error("Failed to load graph data:", err);
    } finally {
      setIsGraphLoading(false);
    }
  }, []);

  // Load initial samples and workspace
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        const sampleList = await fetchSamples();
        setSamples(sampleList);

        const scanData = await scanWorkspace("sample_projects/csharp_ecommerce");
        setSymbols(scanData.symbols);

        const defaultTarget =
          scanData.symbols.find((s) => s.id === "UserService.GetUser") || scanData.symbols[0];

        if (defaultTarget) {
          setSelectedSymbol(defaultTarget);
          const impactData = await calculateImpact(defaultTarget.id);
          setReport(impactData);
          await refreshGraph(defaultTarget.id);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [refreshGraph]);

  // Handle symbol selection
  const handleSelectSymbol = async (sym: SymbolNode) => {
    setSelectedSymbol(sym);
    try {
      const impactData = await calculateImpact(sym.id);
      setReport(impactData);
      await refreshGraph(sym.id);
    } catch (err) {
      console.error("Failed to load impact report:", err);
    }
  };

  // Handle node clicked directly on the graph canvas
  const handleGraphNodeClick = useCallback(
    async (nodeId: string) => {
      const matched = symbols.find((s) => s.id === nodeId);
      if (matched) {
        handleSelectSymbol(matched);
      }
    },
    [symbols]
  );

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
        await refreshGraph(firstSym.id);
      } else {
        setSelectedSymbol(null);
        setReport(null);
        setGraphNodes([]);
        setGraphEdges([]);
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
        await refreshGraph(selectedSymbol.id);
      }
    } catch (err) {
      console.error("Rescan failed:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleProjectLoaded = async (newSample: ProjectSample, newSymbols: SymbolNode[]) => {
    // Add to samples list if not present
    setSamples((prev) => {
      const exists = prev.some((s) => s.path === newSample.path);
      return exists ? prev : [newSample, ...prev];
    });
    setActiveWorkspace(newSample.path);
    setSymbols(newSymbols);

    const firstSym = newSymbols[0] || null;
    setSelectedSymbol(firstSym);

    if (firstSym) {
      try {
        const impactData = await calculateImpact(firstSym.id);
        setReport(impactData);
        await refreshGraph(firstSym.id);
      } catch (err) {
        console.error("Failed to calculate impact for project target:", err);
      }
    } else {
      setReport(null);
      setGraphNodes([]);
      setGraphEdges([]);
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
        onOpenPRModal={() => setIsPRModalOpen(true)}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
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
          <div className="flex items-center justify-between px-5 pt-3 border-b border-slate-800/80 bg-slate-950/50 flex-shrink-0">
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
              <span>{graphNodes.length} Nodes • {graphEdges.length} Edges</span>
            </div>
          </div>

          {/* Active Tab Content Area */}
          <div className="flex-1 overflow-hidden p-4 relative">
            {activeTab === "graph" && (
              <div className="w-full h-full">
                <GraphView
                  nodesData={graphNodes}
                  edgesData={graphEdges}
                  selectedSymbolId={selectedSymbol?.id || null}
                  onSelectNode={handleGraphNodeClick}
                  isLoading={isGraphLoading}
                />
              </div>
            )}

            {activeTab === "sandbox" && (
              <div className="w-full h-full">
                <CodeSandbox
                  symbol={selectedSymbol}
                  onSelectCaller={(callerId) => {
                    const matched = symbols.find((s) => s.id === callerId);
                    if (matched) handleSelectSymbol(matched);
                  }}
                />
              </div>
            )}

            {activeTab === "callers" && report && (
              <div className="h-full overflow-y-auto space-y-4 max-w-4xl mx-auto pr-2">
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
                    <button
                      key={node.id}
                      onClick={() => handleSelectSymbol(node)}
                      className="w-full text-left p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 text-xs">
                          <FontAwesomeIcon
                            icon={node.symbol_type === "controller" ? ICONS.controller : ICONS.service}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white font-mono group-hover:text-cyan-300 transition-colors">
                            {node.id}
                          </div>
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
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* GitHub PR Blast Radius Card Modal */}
      <PRReportModal
        isOpen={isPRModalOpen}
        onClose={() => setIsPRModalOpen(false)}
        symbolId={selectedSymbol?.id || null}
        report={report}
      />

      {/* Upload & Analyze Project Modal */}
      <UploadProjectModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onProjectLoaded={handleProjectLoaded}
      />
    </div>
  );
};

export default App;
