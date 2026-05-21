"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RefreshCw,
  Square, Highlighter, ArrowRight, Type, Eraser, Trash2,
} from "lucide-react";
import type { FieldDetail } from "@/lib/parser-types";

// Configure pdf.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

type Tool = "rect" | "highlight" | "arrow" | "text" | "eraser" | "none";
type Stroke = "thin" | "medium" | "thick";

interface Annotation {
  id: string;
  tool: Tool;
  page: number;
  // normalized 0..1 coords relative to page
  x1: number; y1: number; x2: number; y2: number;
  color: string;
  stroke: number;
  text?: string;
}

const COLORS = [
  { name: "red", value: "#ef4444" },
  { name: "blue", value: "#3b82f6" },
  { name: "green", value: "#22c55e" },
  { name: "yellow", value: "#eab308" },
  { name: "purple", value: "#a855f7" },
];

const STROKE_PX: Record<Stroke, number> = { thin: 2, medium: 4, thick: 6 };

interface Props {
  file: File;
  highlight: FieldDetail | null;
}

export function PdfViewer({ file, highlight }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>("none");
  const [color, setColor] = useState(COLORS[0].value);
  const [stroke, setStroke] = useState<Stroke>("medium");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [drawing, setDrawing] = useState<Annotation | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number }>({ w: 800, h: 1000 });

  const fileUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(fileUrl), [fileUrl]);

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");
  const isText = !isPdf && !isImage;

  // Reset on file change
  useEffect(() => {
    setPageNum(1);
    setAnnotations([]);
    setDrawing(null);
  }, [file]);

  // When highlight changes, jump to the page
  useEffect(() => {
    if (highlight) setPageNum(highlight.location.page_number);
  }, [highlight]);

  const overlayRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "none") return;
    const rect = overlayRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (tool === "eraser") {
      // find topmost annotation on this page containing (x,y)
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
        id: `a_${Date.now()}`, tool, page: pageNum,
        x1: x, y1: y, x2: x + 0.18, y2: y + 0.04,
        color, stroke: STROKE_PX[stroke], text,
      }]);
      return;
    }

    setDrawing({
      id: `a_${Date.now()}`, tool, page: pageNum,
      x1: x, y1: y, x2: x, y2: y,
      color, stroke: STROKE_PX[stroke],
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing) return;
    const rect = overlayRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setDrawing({ ...drawing, x2: x, y2: y });
  };

  const onPointerUp = () => {
    if (!drawing) return;
    if (Math.abs(drawing.x2 - drawing.x1) > 0.002 || Math.abs(drawing.y2 - drawing.y1) > 0.002) {
      setAnnotations((arr) => [...arr, drawing]);
    }
    setDrawing(null);
  };

  // Mouse wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(2, Math.max(0.5, +(z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))));
  };

  const showHighlight =
    highlight && highlight.location.page_number === pageNum;

  // Compute highlight rect in normalized coords (0..1) using bounding box width/height
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

  const displayedW = pageSize.w * zoom;
  const displayedH = pageSize.h * zoom;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="border-b border-border bg-card/50 p-2 space-y-2">
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
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Tools:</span>
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
          <span className="ml-2 text-muted-foreground">Color:</span>
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className={`h-5 w-5 rounded-full border-2 transition-all ${color === c.value ? "border-foreground ring-2 ring-ring/30" : "border-border"}`}
              style={{ backgroundColor: c.value }}
              aria-label={c.name}
            />
          ))}
          <select value={stroke} onChange={(e) => setStroke(e.target.value as Stroke)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
            <option value="thin">Thin</option>
            <option value="medium">Medium</option>
            <option value="thick">Thick</option>
          </select>
          <button
            onClick={() => setAnnotations([])}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear All
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="relative flex-1 overflow-auto bg-muted/30" onWheel={onWheel}>
        <div className="flex min-h-full items-start justify-center p-6">
          <div
            className="relative shadow-lg"
            style={{ width: displayedW, height: displayedH, cursor: tool === "none" ? "default" : "crosshair" }}
          >
            {/* PDF / image / text base layer */}
            {isPdf && (
              <Document
                file={fileUrl}
                onLoadSuccess={(d) => setNumPages(d.numPages)}
                loading={<div className="p-6 text-sm text-muted-foreground">Loading PDF…</div>}
                error={<div className="p-6 text-sm text-destructive">Failed to load PDF</div>}
              >
                <Page
                  pageNumber={pageNum}
                  width={displayedW}
                  onLoadSuccess={(p) => {
                    // base size at zoom=1
                    setPageSize({ w: p.width / zoom, h: p.height / zoom });
                  }}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
              </Document>
            )}
            {isImage && (
              <img
                src={fileUrl}
                alt=""
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setPageSize({ w: img.naturalWidth, h: img.naturalHeight });
                }}
                style={{ width: displayedW, height: "auto", display: "block" }}
              />
            )}
            {isText && (
              <div className="h-full w-full overflow-auto bg-card p-4 text-xs">
                <TextPreview file={file} />
              </div>
            )}

            {/* Annotation overlay */}
            <div
              ref={overlayRef}
              className="absolute inset-0"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {[...annotations.filter((a) => a.page === pageNum), drawing].filter(Boolean).map((a) => (
                  <AnnotationShape key={a!.id} a={a!} w={displayedW} h={displayedH} />
                ))}
              </svg>

              {/* extraction highlight */}
              {showHighlight && hlRect && (
                <div
                  className="pointer-events-none absolute animate-[pulse_2s_ease-in-out_infinite] rounded-sm border-2 border-dashed transition-all duration-300"
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

function AnnotationShape({ a, w, h }: { a: Annotation; w: number; h: number }) {
  const x1 = a.x1 * w, y1 = a.y1 * h, x2 = a.x2 * w, y2 = a.y2 * h;
  const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
  const width = Math.abs(x2 - x1), height = Math.abs(y2 - y1);

  if (a.tool === "rect") {
    return <rect x={minX} y={minY} width={width} height={height} fill="none" stroke={a.color} strokeWidth={a.stroke} />;
  }
  if (a.tool === "highlight") {
    return <rect x={minX} y={minY} width={width} height={height} fill={a.color} fillOpacity={0.3} />;
  }
  if (a.tool === "arrow") {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 12;
    const hx1 = x2 - headLen * Math.cos(angle - Math.PI / 7);
    const hy1 = y2 - headLen * Math.sin(angle - Math.PI / 7);
    const hx2 = x2 - headLen * Math.cos(angle + Math.PI / 7);
    const hy2 = y2 - headLen * Math.sin(angle + Math.PI / 7);
    return (
      <g stroke={a.color} strokeWidth={a.stroke} fill={a.color}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <polygon points={`${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}`} />
      </g>
    );
  }
  if (a.tool === "text") {
    return (
      <g>
        <rect x={minX} y={minY} width={Math.max(width, 80)} height={Math.max(height, 24)} fill={a.color} fillOpacity={0.1} stroke={a.color} strokeWidth={1} />
        <text x={minX + 6} y={minY + 16} fill={a.color} fontSize={13} fontFamily="system-ui">{a.text}</text>
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
