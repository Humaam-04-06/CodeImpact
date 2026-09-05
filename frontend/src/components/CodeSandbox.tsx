import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ICONS } from "../utils/icons";
import type { SymbolNode, Parameter, BreakingChange } from "../types/impact";
import { simulateSignatureChange } from "../services/api";

interface CodeSandboxProps {
  symbol: SymbolNode | null;
  onSelectCaller?: (callerId: string) => void;
}

export const CodeSandbox: React.FC<CodeSandboxProps> = ({ symbol }) => {
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [returnType, setReturnType] = useState<string>("");
  const [breakingChanges, setBreakingChanges] = useState<BreakingChange[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [hasSimulated, setHasSimulated] = useState<boolean>(false);

  // New parameter draft inputs
  const [newParamName, setNewParamName] = useState("");
  const [newParamType, setNewParamType] = useState("string");
  const [newParamDefault, setNewParamDefault] = useState("");

  // Sync state when symbol changes
  useEffect(() => {
    if (symbol) {
      setParameters([...symbol.parameters]);
      setReturnType(symbol.return_type || "void");
      setBreakingChanges([]);
      setHasSimulated(false);
    }
  }, [symbol]);

  // Determine Monaco language mode from file extension
  const getEditorLanguage = (filePath?: string) => {
    if (!filePath) return "csharp";
    if (filePath.endsWith(".cs")) return "csharp";
    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) return "typescript";
    if (filePath.endsWith(".py")) return "python";
    return "javascript";
  };

  // Add parameter to virtual signature
  const handleAddParameter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParamName.trim()) return;

    const param: Parameter = {
      name: newParamName.trim(),
      type_annotation: newParamType.trim(),
      default_value: newParamDefault.trim() || undefined,
    };

    setParameters([...parameters, param]);
    setNewParamName("");
    setNewParamDefault("");
  };

  // Remove parameter from virtual signature
  const handleRemoveParameter = (index: number) => {
    const updated = [...parameters];
    updated.splice(index, 1);
    setParameters(updated);
  };

  // Reset to original symbol signature
  const handleReset = () => {
    if (symbol) {
      setParameters([...symbol.parameters]);
      setReturnType(symbol.return_type || "void");
      setBreakingChanges([]);
      setHasSimulated(false);
    }
  };

  // Execute simulation against backend AST call graph
  const handleRunSimulation = async () => {
    if (!symbol) return;
    setIsSimulating(true);
    try {
      const res = await simulateSignatureChange(symbol.id, parameters, returnType);
      setBreakingChanges(res.breaking_changes);
      setHasSimulated(true);
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!symbol) {
    return (
      <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl p-8 text-center bg-slate-900/20">
        <FontAwesomeIcon icon={ICONS.blastTarget} className="text-slate-600 text-3xl mb-2" />
        <span className="text-xs font-mono text-slate-500">Select a symbol to open What-If Sandbox</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 overflow-hidden">
      {/* Left Column: Monaco Code Editor View */}
      <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950 shadow-2xl">
        {/* Editor Header Bar */}
        <div className="h-10 px-4 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <FontAwesomeIcon icon={ICONS.code} className="text-cyan-400 text-xs" />
            <span className="font-bold text-white">{symbol.id}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">{symbol.file_path}</span>
          </div>

          <div className="text-[11px] font-mono text-slate-500">
            Line {symbol.line_number} - {symbol.end_line_number}
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 min-h-[350px]">
          <Editor
            height="100%"
            language={getEditorLanguage(symbol.file_path)}
            theme="vs-dark"
            value={symbol.source_code}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              renderLineHighlight: "all",
              automaticLayout: true,
            }}
          />
        </div>
      </div>

      {/* Right Column: "What-If" Virtual Signature Modifier & Diagnostics */}
      <div className="w-full lg:w-96 flex flex-col rounded-2xl border border-slate-800/80 bg-slate-950/80 backdrop-blur-md overflow-hidden shadow-2xl flex-shrink-0">
        {/* Panel Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={ICONS.simulate} className="text-cyan-400 text-sm" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white m-0">
              "What-If" Signature Sandbox
            </h3>
          </div>

          <button
            onClick={handleReset}
            title="Reset to original signature"
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
          >
            <FontAwesomeIcon icon={ICONS.refresh} className="mr-1 text-[10px]" />
            Reset
          </button>
        </div>

        {/* Scrollable Config Panel */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
          {/* Active Signature Preview */}
          <div>
            <label className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
              Simulated Function Signature
            </label>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-cyan-300 break-all leading-relaxed">
              <span className="text-purple-400">{returnType}</span>{" "}
              <span className="text-white font-bold">{symbol.name}</span>(
              {parameters.map((p, idx) => (
                <span key={idx}>
                  <span className="text-amber-300">{p.type_annotation || "var"}</span>{" "}
                  <span className="text-slate-200">{p.name}</span>
                  {p.default_value && (
                    <span className="text-slate-400"> = {p.default_value}</span>
                  )}
                  {idx < parameters.length - 1 && <span className="text-slate-500">, </span>}
                </span>
              ))}
              )
            </div>
          </div>

          {/* Current Parameters List */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider block">
              Parameters ({parameters.length})
            </label>

            {parameters.length === 0 ? (
              <div className="text-slate-500 italic text-[11px]">No parameters</div>
            ) : (
              <div className="space-y-1.5">
                {parameters.map((param, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-amber-400 font-semibold">{param.type_annotation || "var"}</span>
                      <span className="text-white">{param.name}</span>
                      {param.default_value && (
                        <span className="text-[10px] text-slate-500 truncate">
                          = {param.default_value}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveParameter(idx)}
                      className="text-slate-500 hover:text-rose-400 px-1.5 py-0.5 rounded transition-colors"
                      title="Remove parameter"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Parameter Form */}
          <form onSubmit={handleAddParameter} className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-2">
            <div className="text-[10px] font-mono font-bold uppercase text-slate-400">
              Add Experimental Parameter
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Type (e.g. bool)"
                value={newParamType}
                onChange={(e) => setNewParamType(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500/50"
              />
              <input
                type="text"
                placeholder="Name (e.g. includeHistory)"
                value={newParamName}
                onChange={(e) => setNewParamName(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <input
              type="text"
              placeholder="Default Value (optional, e.g. false)"
              value={newParamDefault}
              onChange={(e) => setNewParamDefault(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500/50"
            />

            <button
              type="submit"
              disabled={!newParamName.trim()}
              className="w-full py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors disabled:opacity-50"
            >
              + Add Parameter
            </button>
          </form>

          {/* Run Simulation Action Button */}
          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-rose-600 via-purple-600 to-cyan-600 hover:from-rose-500 hover:to-cyan-500 text-white shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <FontAwesomeIcon
              icon={isSimulating ? ICONS.refresh : ICONS.simulate}
              className={isSimulating ? "animate-spin" : ""}
            />
            <span>{isSimulating ? "Analyzing Call Sites..." : "Simulate Impact & Breaking Changes"}</span>
          </button>

          {/* Simulation Results Breakdown */}
          {hasSimulated && (
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Diagnostics ({breakingChanges.length})
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    breakingChanges.length > 0
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  }`}
                >
                  {breakingChanges.length > 0 ? "Breaking Changes Found" : "Safe - No Breaking Callers"}
                </span>
              </div>

              {breakingChanges.length === 0 ? (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <FontAwesomeIcon icon={ICONS.check} className="text-emerald-400" />
                  <span>All upstream callers match the new signature safely!</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {breakingChanges.map((change, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-bold text-rose-300 font-mono truncate">
                          {change.caller_name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">
                          L{change.call_site_line}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 font-sans leading-relaxed m-0">
                        {change.issue}
                      </p>

                      {change.recommended_fix && (
                        <div className="text-[10px] font-mono text-cyan-300 bg-slate-900/80 rounded p-1.5 border border-slate-800/80">
                          <span className="text-slate-500 font-semibold">Fix: </span>
                          {change.recommended_fix}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
