import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

export const CustomRippleEdge: React.FC<EdgeProps> = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  const isBlastEdge = Boolean(data?.is_blast_edge);
  const rawCall = (data?.raw_call as string) || "";
  const lineNumber = (data?.line_number as number) || 0;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isBlastEdge ? "#ef4444" : "#475569",
          strokeWidth: isBlastEdge ? 2.5 : 1.2,
          strokeDasharray: isBlastEdge ? "6 3" : undefined,
          animation: isBlastEdge ? "dash 1.5s linear infinite" : undefined,
        }}
      />

      {/* Energy ripple pulse packet for blast propagation */}
      {isBlastEdge && (
        <circle r="4" fill="#ef4444" className="filter drop-shadow-[0_0_6px_rgba(239,68,68,0.9)]">
          <animateMotion dur="1.8s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Edge Call Site Label */}
      {rawCall && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border backdrop-blur-md shadow-sm transition-all ${
                isBlastEdge
                  ? "bg-rose-950/90 text-rose-300 border-rose-500/50 shadow-rose-950/40"
                  : "bg-slate-900/80 text-slate-400 border-slate-800"
              }`}
              title={`Call at line ${lineNumber}: ${rawCall}`}
            >
              {rawCall.length > 20 ? `${rawCall.slice(0, 18)}...` : rawCall}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
