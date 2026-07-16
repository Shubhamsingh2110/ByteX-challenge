"use client";

import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from "recharts";
import { formatMoney, type SankeyData } from "@repo/core";

interface NodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name: string; color: string; value: number };
  containerWidth: number;
}

function SankeyNode({ x, y, width, height, payload, containerWidth }: NodeProps) {
  const isLeftHalf = x < containerWidth / 2;
  const labelX = isLeftHalf ? x + width + 8 : x - 8;
  const anchor = isLeftHalf ? "start" : "end";

  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={payload.color} radius={2} />
      <text
        x={labelX}
        y={y + height / 2}
        textAnchor={anchor}
        dominantBaseline="middle"
        fontSize={11}
        fill="var(--foreground)"
      >
        {payload.name}
        <tspan fill="var(--muted)"> · {formatMoney(payload.value)}</tspan>
      </text>
    </Layer>
  );
}

interface LinkProps {
  sourceX: number;
  targetX: number;
  sourceY: number;
  targetY: number;
  sourceControlX: number;
  targetControlX: number;
  linkWidth: number;
  index: number;
  payload: { target: { color: string }; source: { color: string } };
}

function SankeyLink({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  payload,
}: LinkProps) {
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={payload.target.color}
      strokeWidth={Math.max(1, linkWidth)}
      strokeOpacity={0.25}
    />
  );
}

function SankeyTooltip({ active, payload }: { active?: boolean; payload?: { payload?: { value?: number } }[] }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.payload?.value;
  if (typeof value !== "number") return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg">
      {formatMoney(value)}
    </div>
  );
}

export function SankeyChart({ data }: { data: SankeyData }) {
  if (data.nodes.length === 0 || data.links.length === 0) {
    return (
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold">Cash flow</h2>
        <p className="py-10 text-center text-sm text-muted">
          Add income and expenses to see how your money flows.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Cash flow</h2>
        <span className="text-[11px] text-muted">income → available → spending</span>
      </div>
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={data}
            nodePadding={24}
            nodeWidth={12}
            linkCurvature={0.5}
            iterations={64}
            margin={{ top: 12, bottom: 12, left: 4, right: 4 }}
            node={<SankeyNode {...({} as NodeProps)} />}
            link={<SankeyLink {...({} as LinkProps)} />}
          >
            <Tooltip content={<SankeyTooltip />} />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
