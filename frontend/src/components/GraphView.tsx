import React, { useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ICONS } from "../utils/icons";
import { CustomSymbolNode } from "./CustomNodes";
import { CustomRippleEdge } from "./CustomEdges";

interface GraphViewProps {
  nodesData: Node[];
  edgesData: Edge[];
  selectedSymbolId: string | null;
  onSelectNode: (nodeId: string) => void;
  isLoading: boolean;
}

export const GraphView: React.FC<GraphViewProps> = ({
  nodesData,
  edgesData,
  selectedSymbolId,
  onSelectNode,
  isLoading,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Register custom node and edge types
  const nodeTypes = useMemo<any>(
    () => ({
      customSymbolNode: CustomSymbolNode,
    }),
    []
  );

  const edgeTypes = useMemo<any>(
    () => ({
      customRippleEdge: CustomRippleEdge,
      default: CustomRippleEdge,
    }),
    []
  );

  // Synchronize incoming graph data from backend
  useEffect(() => {
    // Mark the selected node as selected in React Flow state
    const mappedNodes = nodesData.map((node) => ({
      ...node,
      selected: node.id === selectedSymbolId,
    }));
    setNodes(mappedNodes);
    setEdges(edgesData);
  }, [nodesData, edgesData, selectedSymbolId, setNodes, setEdges]);

  // Handle clicking a node inside the interactive graph
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950/60 rounded-2xl border border-slate-800/80">
        <FontAwesomeIcon icon={ICONS.refresh} className="text-cyan-400 text-3xl animate-spin mb-3" />
        <span className="text-xs font-mono text-slate-400">Constructing Code Knowledge Graph...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950 shadow-2xl">
      {/* Legend & Controls Overlay */}
      <div className="absolute top-4 left-4 z-20 bg-slate-950/80 backdrop-blur-md border border-slate-800/90 rounded-xl p-3 shadow-lg space-y-2 max-w-xs">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">
          <FontAwesomeIcon icon={ICONS.blastTarget} className="text-rose-400 text-xs" />
          <span>Blast Radius Topology</span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span>Target Changed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>HTTP Controller</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            <span>Calling Service</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>DB / Repository</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Unit Test</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-rose-500" />
            <span>Ripple Pulse</span>
          </div>
        </div>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange<Node>}
        onEdgesChange={onEdgesChange as OnEdgesChange<Edge>}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        className="bg-[#0b0f19]"
      >
        <Background color="#1e293b" gap={24} size={1} />
        <Controls
          className="!bg-slate-900 !border-slate-800 !shadow-xl !rounded-xl overflow-hidden [&>button]:!bg-slate-900 [&>button]:!border-slate-800 [&>button]:!text-slate-300 hover:[&>button]:!text-white"
        />
        <MiniMap
          nodeColor={(n: any) => {
            if (n.data?.is_target) return "#ef4444";
            if (n.data?.symbol_type === "controller") return "#a855f7";
            if (n.data?.symbol_type === "repository" || n.data?.is_db_operation) return "#f59e0b";
            if (n.data?.symbol_type === "test" || n.data?.is_test) return "#10b981";
            return "#06b6d4";
          }}
          maskColor="rgba(11, 15, 25, 0.7)"
          className="!bg-slate-950 !border-slate-800 !rounded-xl overflow-hidden"
        />
      </ReactFlow>
    </div>
  );
};
