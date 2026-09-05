import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ICONS, getSymbolIcon, getSymbolColor } from "../utils/icons";
import type { SymbolNode } from "../types/impact";

interface SidebarProps {
  symbols: SymbolNode[];
  selectedSymbolId: string | null;
  onSelectSymbol: (symbol: SymbolNode) => void;
  isLoading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  symbols,
  selectedSymbolId,
  onSelectSymbol,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const filterCounts = useMemo(() => {
    return {
      all: symbols.length,
      controller: symbols.filter((s) => s.symbol_type === "controller").length,
      service: symbols.filter((s) => s.symbol_type === "service").length,
      repository: symbols.filter((s) => s.symbol_type === "repository" || s.is_db_operation).length,
      test: symbols.filter((s) => s.symbol_type === "test" || s.is_test).length,
    };
  }, [symbols]);

  const filteredSymbols = useMemo(() => {
    return symbols.filter((sym) => {
      const matchesSearch =
        sym.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sym.file_path.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;
      if (selectedFilter === "all") return true;
      if (selectedFilter === "controller") return sym.symbol_type === "controller";
      if (selectedFilter === "service") return sym.symbol_type === "service";
      if (selectedFilter === "repository") return sym.symbol_type === "repository" || sym.is_db_operation;
      if (selectedFilter === "test") return sym.symbol_type === "test" || sym.is_test;
      return true;
    });
  }, [symbols, searchTerm, selectedFilter]);

  return (
    <aside className="w-80 border-r border-slate-800/80 bg-slate-950/60 flex flex-col h-[calc(100vh-4rem)] flex-shrink-0">
      {/* Header & Search */}
      <div className="p-4 border-b border-slate-800/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={ICONS.tree} className="text-cyan-400 text-xs" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 m-0">
              Codebase Symbols
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {symbols.length} nodes
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <FontAwesomeIcon
            icon={ICONS.search}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"
          />
          <input
            type="text"
            placeholder="Search function, class, file..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
          {(["all", "controller", "service", "repository", "test"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedFilter(cat)}
              className={`px-2 py-1 rounded-md capitalize font-medium flex items-center gap-1 transition-all ${
                selectedFilter === cat
                  ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-300 hover:bg-slate-900 border border-transparent"
              }`}
            >
              <span>{cat}</span>
              <span className="text-[10px] text-slate-500">({filterCounts[cat]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Symbol List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <FontAwesomeIcon icon={ICONS.refresh} className="animate-spin text-cyan-400 text-lg" />
            <span>Analyzing AST &amp; call graph...</span>
          </div>
        ) : filteredSymbols.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No symbols match your filter.
          </div>
        ) : (
          filteredSymbols.map((sym) => {
            const isSelected = sym.id === selectedSymbolId;
            const icon = getSymbolIcon(sym.symbol_type, isSelected);
            const colorClass = getSymbolColor(sym.symbol_type, isSelected);

            return (
              <button
                key={sym.id}
                onClick={() => onSelectSymbol(sym)}
                className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 group ${
                  isSelected
                    ? "bg-rose-950/30 border-rose-500/50 shadow-md shadow-rose-950/40"
                    : "bg-slate-900/40 hover:bg-slate-900 border-slate-800/60 hover:border-slate-700/80"
                }`}
              >
                {/* Type Icon Badge */}
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 border ${colorClass}`}
                >
                  <FontAwesomeIcon icon={icon} className="text-xs" />
                </div>

                {/* Symbol Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-semibold truncate ${
                        isSelected ? "text-rose-300" : "text-slate-200 group-hover:text-white"
                      }`}
                    >
                      {sym.name}
                    </span>
                    {sym.http_method && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700/50 flex-shrink-0">
                        {sym.http_method}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] font-mono text-slate-500 truncate">
                    {sym.class_name ? `${sym.class_name}` : sym.file_path}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                    <span>L{sym.line_number}</span>
                    <span>•</span>
                    <span>{sym.calls.length} calls</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
