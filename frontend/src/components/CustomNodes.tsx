import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ICONS, getSymbolIcon, getSymbolColor } from "../utils/icons";
import type { SymbolType, Parameter } from "../types/impact";

export interface CustomNodeData {
  id: string;
  name: string;
  full_name: string;
  file_path: string;
  line_number: number;
  symbol_type: SymbolType;
  return_type?: string;
  parameters: Parameter[];
  http_method?: string;
  http_route?: string;
  is_db_operation: boolean;
  is_test: boolean;
  is_target: boolean;
  is_upstream: boolean;
  is_downstream: boolean;
  in_blast: boolean;
  [key: string]: unknown;
}

export const CustomSymbolNode: React.FC<NodeProps<any>> = memo(({ data, selected }) => {
  const nodeData = data as CustomNodeData;
  const {
    id,
    name,
    file_path,
    line_number,
    symbol_type,
    return_type,
    parameters = [],
    http_method,
    is_target,
    is_upstream,
    is_downstream,
    in_blast,
  } = nodeData;

  const icon = getSymbolIcon(symbol_type, is_target);
  const colorClasses = getSymbolColor(symbol_type, is_target);

  // Border & Glow styling based on blast status
  let containerStyle = "border-slate-800 bg-slate-900/90 hover:border-slate-700";
  if (is_target) {
    containerStyle = "border-rose-500 bg-rose-950/40 shadow-xl shadow-rose-950/50 blast-ripple ring-2 ring-rose-500/50";
  } else if (is_upstream) {
    containerStyle = "border-purple-500/80 bg-purple-950/30 shadow-lg shadow-purple-950/30 ring-1 ring-purple-500/40";
  } else if (is_downstream) {
    containerStyle = "border-amber-500/80 bg-amber-950/30 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/40";
  } else if (!in_blast) {
    containerStyle = "border-slate-800/40 bg-slate-950/40 opacity-40";
  }

  if (selected) {
    containerStyle += " ring-2 ring-cyan-400";
  }

  return (
    <div
      className={`min-w-[240px] max-w-[280px] rounded-xl border p-3 shadow-md backdrop-blur-md transition-all duration-200 ${containerStyle}`}
    >
      {/* React Flow Handles for Directed Edges */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-700 !border-2 !border-slate-900 hover:!bg-cyan-400 transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-700 !border-2 !border-slate-900 hover:!bg-rose-400 transition-colors"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border ${colorClasses}`}
          >
            <FontAwesomeIcon icon={icon} className="text-[11px]" />
          </div>
          <span className="text-xs font-bold text-white truncate font-mono">{name}</span>
        </div>

        {/* Badges */}
        {is_target ? (
          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500 text-white shadow-sm flex-shrink-0">
            TARGET
          </span>
        ) : http_method ? (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/60 flex-shrink-0">
            {http_method}
          </span>
        ) : is_upstream ? (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/50 flex-shrink-0">
            CALLER
          </span>
        ) : is_downstream ? (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/50 flex-shrink-0">
            MUTATES DB
          </span>
        ) : (
          <span className="text-[9px] text-slate-500 capitalize">{symbol_type}</span>
        )}
      </div>

      {/* Signature info */}
      <div className="text-[10px] font-mono text-slate-400 bg-slate-950/60 rounded p-1.5 border border-slate-800/60 space-y-0.5 mb-2">
        <div className="text-slate-500 truncate">{id}</div>
        {return_type && (
          <div className="text-cyan-400 truncate">
            <span className="text-slate-500">returns: </span>
            {return_type}
          </div>
        )}
        {parameters.length > 0 && (
          <div className="text-slate-400 truncate">
            <span className="text-slate-500">args: </span>
            {parameters.map((p) => p.name).join(", ")}
          </div>
        )}
      </div>

      {/* File Location Footer */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span className="truncate max-w-[170px]" title={file_path}>
          {file_path.split("/").slice(-2).join("/")}
        </span>
        <span className="flex-shrink-0 text-slate-400">L{line_number}</span>
      </div>
    </div>
  );
});

CustomSymbolNode.displayName = "CustomSymbolNode";
