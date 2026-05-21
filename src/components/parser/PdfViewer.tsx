"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RefreshCw,
  Square, Highlighter, ArrowRight, Type, Eraser, Trash2, MousePointer2,
} from "lucide-react";
import type { FieldDetail } from "@/lib/parser-types";

// Configure pdf.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

type Tool = "none" | "rect" | "highlight" | "arrow" | "text" | "eraser";

interface Annotation {
  id: string;
  tool: Exclude<Tool, "none" | "eraser">;
  page: number;
  // normalized 0..1 coords
  x1: number; y1: number; x2: number; y2: number;
  color: string;
  text?: string;
}

const COLORS = [
  { name: "Red",    value: "#ef4444", light: "#fecaca" },
  { name: "Blue",   value: "#3b82f6", light: "#bfdbfe" },
  { name: "Green",  value: "#22c55e", light: "#bbf7d0" },
  { name: "Yellow", value: "#eab308", light: "#fef08a" },
  { name: "Purple", value: "#a855f7", light: "#e9d5ff" },
];

interface Props {
  file: File;
  highlight: FieldDetail | null;
}

export function PdfViewer({ file, highlight }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>("none");
  const [colorIdx, setColorIdx] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [drawing, setDrawing] = useState<Annotation | null>(null);

  const color = COLORS[colorIdx];

  const fileUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(fileUrl), [fileUrl]);

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");
  const isText = !isPdf && !isImage;

  useEffect(() => {
    setPageNum(1);
    setAnnotations([]);
    setDrawing(null);
  }, [file]);

  useEffect(() => {
    if (highlight) setPageNum(highlight.location.page_number);
  }, [highlight]);

  const overlayRef = useRef<HTMLDivElement>(null);

  /** Compute normalized 0..1 coords from a pointer event, relative to the overlay's box. */
  const pointToNorm = (e: React.PointerEvent) => {
    const el = overlayRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    // Clamp to [0,1] so dragging outside doesn't produce huge values.
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool === "none") return;
    e.preventDefault();
    const { x, y } = pointToNorm(e);

    if (tool === "eraser") {
      const target = [...annotations].reverse().find((a) => {
        if (a.page !== pageNum) return false;
        const minX = Math.min(a.x1, a.x2), maxX = Math.max(a.x1, a.x2);
        const minY = Math.min(a.y1, a.y2), maxY = Math.max(a.y1, a.y2);
        return x >= minX - 0.005 && x <= maxX + 0.005 && y >= minY - 0.005 && y <= maxY + 0.005;
      });
      if (target) setAnnotations((arr) => arr.filter((a) => a.id !== target.id));
      return;
    }

    if (tool === "text") {
      const text = window.prompt("Annotation text:");
      if (!text) return;
      setAnnotations((arr) => [...arr, {
        id: `a_${Date.now()}`, tool: "text", page: pageNum,
        x1: x, y1: y, x2: x + 0.2, y2: y + 0.04,
        color: color.value, text,
      }]);
      return;
    }

    // capture on the overlay (which is also currentTarget) so we don't lose events
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing({
      id: `a_${Date.now()}`,
      tool: tool as Annotation["tool"],
      page: pageNum,
      x1: x, y1: y, x2: x, y2: y,
      color: color.value,
    });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawing) return;
    const { x, y } = pointToNorm(e);
    setDrawing((cur) => (cur ? { ...cur, x2: x, y2: y } : cur));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDrawing((cur) => {
      if (!cur) return null;
      if (Math.abs(cur.x2 - cur.x1) > 0.002 || Math.abs(cur.y2 - cur.y1) > 0.002) {
        setAnnotations((arr) => [...arr, cur]);
      }
      return null;
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(2, Math.max(0.5, +(z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))));
  };

  const showHighlight = highlight && highlight.location.page_number === pageNum;
  const hlRect = useMemo(() => {
    if (!showHighlight) return null;
    const bb = highlight!.location.bounding_box;
    return {
      left: bb.xmin / bb.width,
      top: bb.ymin / bb.height,
      width: (bb.xmax - bb.xmin) / bb.width,
      height: (bb.ymax - bb.ymin) / bb.height,
    };
  }, [highlight, showHighlight]);

  // Page width based on zoom (height auto-fits)
  const pageWidth = 720 * zoom;

  const cursorClass =
    tool === "none" ? "cursor-default"
    : tool === "eraser" ? "cursor-pointer"
    : tool === "text" ? "cursor-text"
    : "cursor-crosshair";

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="space-y-2 border-b border-border bg-card/50 p-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {isPdf && (
            <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
              <button onClick={() => setPageNum((p) => Math.max(1, p - 1))} className="rounded p-0.5 hover:bg-muted" disabled={pageNum <= 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-1 font-medium">
                <input
                  type="number"
                  min={1}
                  max={numPages || 1}
                  value={pageNum}
                  onChange={(e) => setPageNum(Math.min(numPages || 1, Math.max(1, +e.target.value || 1)))}
                  className="w-10 bg-transparent text-center outline-none"
                />
                / {numPages || "?"}
              </span>
              <button onClick={() => setPageNum((p) => Math.min(numPages, p + 1))} className="rounded p-0.5 hover:bg-muted" disabled={pageNum >= numPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
            <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="rounded p-0.5 hover:bg-muted"><ZoomOut className="h-3.5 w-3.5" /></button>
            <select value={zoom} onChange={(e) => setZoom(+e.target.value)} className="bg-transparent text-xs outline-none">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
            </select>
            <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)))} className="rounded p-0.5 hover:bg-muted"><ZoomIn className="h-3.5 w-3.5" /></button>
            <button onClick={() => setZoom(1)} className="rounded p-0.5 hover:bg-muted" title="Reset"><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
          <button
            onClick={() => setAnnotations([])}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setTool("none")}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${tool === "none" ? "border-primary bg-accent text-accent-foreground" : "border-border bg-background hover:bg-muted"}`}
            title="Select"
          >
            <MousePointer2 className="h-3.5 w-3.5" />
          </button>
          {([
            ["rect", Square, "Box"],
            ["highlight", Highlighter, "Highlight"],
            ["arrow", ArrowRight, "Arrow"],
            ["text", Type, "Text"],
            ["eraser", Eraser, "Eraser"],
          ] as const).map(([t, Icon, label]) => (
            <button
              key={t}
              onClick={() => setTool((cur) => cur === t ? "none" : t)}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${tool === t ? "border-primary bg-accent text-accent-foreground" : "border-border bg-background hover:bg-muted"}`}
              title={label}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
          <div className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
            <span
              className="inline-block h-3.5 w-3.5 rounded-full border border-border"
              style={{ backgroundColor: color.light }}
              aria-hidden
            />
            <select
              value={colorIdx}
              onChange={(e) => setColorIdx(+e.target.value)}
              className="bg-transparent text-xs outline-none"
            >
              {COLORS.map((c, i) => (
                <option key={c.name} value={i}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div className="relative flex-1 overflow-auto bg-muted/30" onWheel={onWheel}>
        <div className="flex min-h-full items-start justify-center p-4">
          {/* This wrapper auto-sizes to the rendered PDF/image — the absolute overlay
              therefore always matches the displayed content exactly. */}
          <div className={`relative inline-block bg-white shadow-lg ${cursorClass}`}>
            {isPdf && (
              <Document
                file={fileUrl}
                onLoadSuccess={(d) => setNumPages(d.numPages)}
                loading={<div className="p-6 text-sm text-muted-foreground">Loading PDF…</div>}
                error={<div className="p-6 text-sm text-destructive">Failed to load PDF</div>}
              >
                <Page
                  pageNumber={pageNum}
                  width={pageWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
              </Document>
            )}
            {isImage && (
              <img
                src={fileUrl}
                alt=""
                style={{ width: pageWidth, height: "auto", display: "block" }}
              />
            )}
            {isText && (
              <div style={{ width: pageWidth, minHeight: 600 }} className="overflow-auto bg-card p-4 text-xs">
                <TextPreview file={file} />
              </div>
            )}

            {/* Annotation overlay — sized 100% of the wrapper so coords always match */}
            <div
              ref={overlayRef}
              className="absolute inset-0"
              style={{ touchAction: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                preserveAspectRatio="none"
                viewBox="0 0 1 1"
              >
                {[...annotations.filter((a) => a.page === pageNum), drawing]
                  .filter(Boolean)
                  .map((a) => (
                    <AnnotationShape key={a!.id} a={a!} />
                  ))}
              </svg>

              {showHighlight && hlRect && (
                <div
                  className="pointer-events-none absolute animate-[pulse_2s_ease-in-out_infinite] rounded-sm border-2 border-dashed"
                  style={{
                    left: `${hlRect.left * 100}%`,
                    top: `${hlRect.top * 100}%`,
                    width: `${hlRect.width * 100}%`,
                    height: `${hlRect.height * 100}%`,
                    borderColor: "#06b6d4",
                    backgroundColor: "rgba(6,182,212,0.18)",
                  }}
                >
                  <div className="absolute -top-6 left-0 whitespace-nowrap rounded bg-cyan-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
                    {highlight!.key_name} · {highlight!.confidence.toFixed(0)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Annotation rendered in a 1×1 SVG viewBox; stroke widths are expressed as
 * fractions so they scale visually with the document.
 */
function AnnotationShape({ a }: { a: Annotation }) {
  const minX = Math.min(a.x1, a.x2), minY = Math.min(a.y1, a.y2);
  const width = Math.abs(a.x2 - a.x1), height = Math.abs(a.y2 - a.y1);
  const sw = 0.003;

  if (a.tool === "rect") {
    return (
      <rect
        x={minX} y={minY} width={width} height={height}
        fill="none" stroke={a.color} strokeWidth={sw}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  if (a.tool === "highlight") {
    return (
      <rect
        x={minX} y={minY} width={width} height={height}
        fill={a.color} fillOpacity={0.28}
      />
    );
  }
  if (a.tool === "arrow") {
    const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const headLen = 0.025;
    const hx1 = a.x2 - headLen * Math.cos(angle - Math.PI / 7);
    const hy1 = a.y2 - headLen * Math.sin(angle - Math.PI / 7);
    const hx2 = a.x2 - headLen * Math.cos(angle + Math.PI / 7);
    const hy2 = a.y2 - headLen * Math.sin(angle + Math.PI / 7);
    return (
      <g stroke={a.color} fill={a.color} strokeWidth={sw} vectorEffect="non-scaling-stroke">
        <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />
        <polygon points={`${a.x2},${a.y2} ${hx1},${hy1} ${hx2},${hy2}`} />
      </g>
    );
  }
  if (a.tool === "text") {
    return (
      <g>
        <rect
          x={minX} y={minY}
          width={Math.max(width, 0.12)}
          height={Math.max(height, 0.03)}
          fill={a.color} fillOpacity={0.1}
          stroke={a.color} strokeWidth={sw / 2}
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={minX + 0.005}
          y={minY + 0.022}
          fill={a.color}
          fontSize={0.018}
          fontFamily="system-ui"
        >
          {a.text}
        </text>
      </g>
    );
  }
  return null;
}

function TextPreview({ file }: { file: File }) {
  const [text, setText] = useState("Loading...");
  useEffect(() => {
    file.text().then(setText).catch(() => setText("(unable to read file)"));
  }, [file]);
  return <pre className="whitespace-pre-wrap font-mono">{text}</pre>;
}
