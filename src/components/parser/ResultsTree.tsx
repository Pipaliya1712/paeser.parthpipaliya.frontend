"use client";
import { useMemo } from "react";
import { MapPin, Copy } from "lucide-react";
import { type FieldDetail, type ParseResponse, toTitleCase } from "@/lib/parser-types";

interface Props {
  response: ParseResponse;
  activeKey: string | null;
  onPinClick: (detail: FieldDetail) => void;
}

function confidenceColor(c: number) {
  if (c >= 90) return "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30";
  if (c >= 70) return "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/40";
  if (c >= 50) return "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400";
  return "bg-[var(--danger)]/15 text-[var(--danger)] border-[var(--danger)]/30";
}

export function ResultsTree({ response, activeKey, onPinClick }: Props) {
  const detailsByKey = useMemo(() => {
    const m = new Map<string, FieldDetail>();
    for (const d of response.field_details) m.set(d.key_name, d);
    return m;
  }, [response]);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(response.extracted_data, null, 2));
    import("sonner").then(({ toast }) => toast.success("Copied to clipboard"));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="text-sm font-semibold">Extracted Data</div>
        <button onClick={copyJson} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
          <Copy className="h-3 w-3" /> Copy JSON
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 font-mono text-xs">
        <TreeNode
          value={response.extracted_data}
          path=""
          detailsByKey={detailsByKey}
          activeKey={activeKey}
          onPinClick={onPinClick}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        <span>Processing: {response.metadata.processing_time_seconds.toFixed(2)}s</span>
        <span>Pages: {response.metadata.pages_processed}</span>
        <span>Model: {response.metadata.model_used}</span>
      </div>
    </div>
  );
}

interface NodeProps {
  value: unknown;
  path: string;
  detailsByKey: Map<string, FieldDetail>;
  activeKey: string | null;
  onPinClick: (d: FieldDetail) => void;
}

function PinBadge({
  detail, active, onClick,
}: { detail: FieldDetail; active: boolean; onClick: () => void }) {
  // No confidence at all — show nothing
  if (!detail.confidence && detail.confidence !== 0) return null;
  if (detail.confidence <= 0 && !detail.location) return null;

  // Has location → clickable pin + confidence
  if (detail.location) {
    return (
      <button
        onClick={onClick}
        className={`ml-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-sans font-medium transition-all ${confidenceColor(detail.confidence)} ${active ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""}`}
        title={`Page ${detail.location.page_number} — ${detail.confidence}% confidence`}
      >
        <MapPin className="h-2.5 w-2.5" />
        {detail.confidence > 0 ? `${detail.confidence.toFixed(0)}%` : "📍"}
      </button>
    );
  }

  // No location but has confidence — show accuracy only (no pin, not clickable)
  if (detail.confidence > 0) {
    return (
      <span
        className={`ml-2 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-sans font-medium ${confidenceColor(detail.confidence)}`}
        title={`${detail.confidence}% confidence`}
      >
        {detail.confidence.toFixed(0)}%
      </span>
    );
  }

  return null;
}

function formatLeaf(v: unknown): string {
  if (v === null) return "—";
  if (v === undefined) return "—";
  if (typeof v === "string") return v;
  return String(v);
}

function TreeNode({ value, path, detailsByKey, activeKey, onPinClick }: NodeProps) {
  if (Array.isArray(value)) {
    return (
      <div className="space-y-0.5">
        {value.map((item, i) => {
          const childPath = `${path}[${i}]`;
          const isLeaf = typeof item !== "object" || item === null;
          const detail = detailsByKey.get(childPath);
          return (
            <div key={i}>
              <span className="text-muted-foreground">[{i}]</span>
              {isLeaf ? (
                <>
                  <span className="ml-2 text-foreground">{formatLeaf(item)}</span>
                  {detail && <PinBadge detail={detail} active={activeKey === childPath} onClick={() => onPinClick(detail)} />}
                </>
              ) : (
                <div className="ml-4 border-l border-border pl-3">
                  <TreeNode value={item} path={childPath} detailsByKey={detailsByKey} activeKey={activeKey} onPinClick={onPinClick} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className="space-y-0.5">
        {entries.map(([k, v]) => {
          const childPath = path ? `${path}.${k}` : k;
          const isLeaf = typeof v !== "object" || v === null;
          const detail = detailsByKey.get(childPath);
          return (
            <div key={k}>
              <span className="text-primary font-sans font-medium">{toTitleCase(k)}</span>
              <span className="ml-1 font-mono text-[10px] text-muted-foreground">({k})</span>
              <span className="text-muted-foreground">:</span>
              {isLeaf ? (
                <>
                  <span className="ml-2 text-foreground">{formatLeaf(v)}</span>
                  {detail && <PinBadge detail={detail} active={activeKey === childPath} onClick={() => onPinClick(detail)} />}
                </>
              ) : (
                <div className="ml-4 border-l border-border pl-3">
                  <TreeNode value={v} path={childPath} detailsByKey={detailsByKey} activeKey={activeKey} onPinClick={onPinClick} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  return <span>{formatLeaf(value)}</span>;
}
