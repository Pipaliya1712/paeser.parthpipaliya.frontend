"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ZoomIn, ZoomOut, RefreshCw,
  Highlighter, ArrowRight, Eraser, Trash2, MousePointer2,
} from "lucide-react";
import type { FieldDetail } from "@/lib/parser-types";

// Configure pdf.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

// Removed "text" tool — only these remain
type Tool = "none" | "highlight" | "arrow" | "eraser";

interface Annotation {
  id: string;
  tool: Exclude<Tool, "none" | "eraser">;
  page: number;
  /** normalized 0..1 coords */
  x1: number; y1: number; x2: number; y2: number;
  color: string;
}

const COLORS = [
  { name: "Red",    value: "#ef4444" },
  { name: "Blue",   value: "#3b82f6" },
  { name: "Green",  value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Purple", value: "#a855f7" },
];

const TOOLS: [Exclude<Tool, "none">, typeof Highlighter, string][] = [
  ["highlight", Highlighter, "Highlight"],
  ["arrow",     ArrowRight,  "Arrow"],
  ["eraser",    Eraser,      "Eraser — hold & drag to erase"],
];

interface Props {
  file: File;
  highlight: FieldDetail | null;
}

/** Hit-test annotation bounding box with some margin */
function hitTest(a: Annotation, x: number, y: number, margin = 0.018): boolean {
  const minX = Math.min(a.x1, a.x2) - margin;
  const maxX = Math.max(a.x1, a.x2) + margin;
  const minY = Math.min(a.y1, a.y2) - margin;
  const maxY = Math.max(a.y1, a.y2) + margin;
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/**
 * Liang–Barsky segment-rect intersection.
 * Returns true if the line segment (sx1,sy1)→(sx2,sy2) intersects the
 * axis-aligned rectangle [rMinX,rMaxX] × [rMinY,rMaxY].
 */
function segmentHitsRect(
  sx1: number, sy1: number, sx2: number, sy2: number,
  rMinX: number, rMinY: number, rMaxX: number, rMaxY: number,
): boolean {
  // Quick point-in-rect checks first
  if (sx1 >= rMinX && sx1 <= rMaxX && sy1 >= rMinY && sy1 <= rMaxY) return true;
  if (sx2 >= rMinX && sx2 <= rMaxX && sy2 >= rMinY && sy2 <= rMaxY) return true;

  const dx = sx2 - sx1;
  const dy = sy2 - sy1;
  let tMin = 0, tMax = 1;

  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > tMax) return false; if (t > tMin) tMin = t; }
    else        { if (t < tMin) return false; if (t < tMax) tMax = t; }
    return true;
  };

  return (
    clip(-dx, sx1 - rMinX) &&
    clip( dx, rMaxX - sx1) &&
    clip(-dy, sy1 - rMinY) &&
    clip( dy, rMaxY - sy1) &&
    tMin <= tMax
  );
}

/** Check if eraser sweep from (x1,y1) to (x2,y2) hits an annotation */
function eraserHitsAnnotation(
  a: Annotation,
  x1: number, y1: number,
  x2: number, y2: number,
  margin = 0.008,
): boolean {
  const rMinX = Math.min(a.x1, a.x2) - margin;
  const rMaxX = Math.max(a.x1, a.x2) + margin;
  const rMinY = Math.min(a.y1, a.y2) - margin;
  const rMaxY = Math.max(a.y1, a.y2) + margin;
  return segmentHitsRect(x1, y1, x2, y2, rMinX, rMinY, rMaxX, rMaxY);
}

/** Normalize pointer position to 0..1 relative to the overlay element */
function normFromEvent(e: React.PointerEvent<HTMLDivElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  };
}

export function PdfViewer({ file, highlight }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>("none");
  const [colorIdx, setColorIdx] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [drawing, setDrawing] = useState<Annotation | null>(null);
  const [activePage, setActivePage] = useState(1);

  // Drag-erase state stored in refs (no re-render needed)
  const erasingRef = useRef(false);
  const erasingPageRef = useRef(1);
  // Store the overlay element where erasing started so coords stay correct
  const erasingElRef = useRef<HTMLDivElement | null>(null);
  // Previous eraser position for segment-based hit detection
  const eraserPrevRef = useRef<{ x: number; y: number } | null>(null);

  const color = COLORS[colorIdx];

  const [fileUrl, setFileUrl] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isPdf  = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");
  const isText  = !isPdf && !isImage;

  useEffect(() => {
    setActivePage(1);
    setAnnotations([]);
    setDrawing(null);
  }, [file]);

  useEffect(() => {
    // Guard: location may be null when backend has no bounding box
    if (highlight?.location) {
      const el = document.getElementById(`pdf-page-${highlight.location.page_number}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [highlight]);

  /* ─── Pointer handlers ─────────────────────────────────────────── */

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, pageNum: number) => {
    if (tool === "none") return;
    e.preventDefault();
    setActivePage(pageNum);
    const { x, y } = normFromEvent(e);

    if (tool === "eraser") {
      // Drag-erase mode: capture pointer, start erasing
      erasingRef.current = true;
      erasingPageRef.current = pageNum;
      erasingElRef.current = e.currentTarget;
      eraserPrevRef.current = { x, y };          // ← seed the segment start
      e.currentTarget.setPointerCapture(e.pointerId);
      // Erase ALL annotations under the initial click
      setAnnotations((arr) =>
        arr.filter((a) => a.page !== pageNum || !eraserHitsAnnotation(a, x, y, x, y))
      );
      return;
    }

    // Drawing tools
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
    // Drag-erase: use the sweep segment from prev→current to catch ALL annotations
    // the eraser path crosses, even overlapping ones that aren't under the cursor tip.
    if (erasingRef.current) {
      const el = erasingElRef.current ?? e.currentTarget;
      const domRect = el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - domRect.left) / domRect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - domRect.top)  / domRect.height));
      const pg = erasingPageRef.current;
      const prev = eraserPrevRef.current ?? { x, y };
      eraserPrevRef.current = { x, y };

      // Remove every annotation whose bbox the eraser segment intersects
      setAnnotations((arr) =>
        arr.filter((a) => a.page !== pg || !eraserHitsAnnotation(a, prev.x, prev.y, x, y))
      );
      return;
    }

    const { x, y } = normFromEvent(e);
    if (!drawing) return;
    setDrawing((cur) => (cur ? { ...cur, x2: x, y2: y } : cur));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (erasingRef.current) {
      erasingRef.current = false;
      eraserPrevRef.current = null;   // reset segment tracking
      return;
    }

    setDrawing((cur) => {
      if (!cur) return null;
      // Only commit if there was meaningful movement
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

  /* ─── Highlight overlay ─────────────────────────────────────────── */

  const hlByPage = useMemo(() => {
    if (!highlight?.location?.bounding_box) return null;
    const bb = highlight.location.bounding_box;
    return {
      page: highlight.location.page_number,
      rect: {
        left:   bb.xmin / bb.width,
        top:    bb.ymin / bb.height,
        width:  (bb.xmax - bb.xmin) / bb.width,
        height: (bb.ymax - bb.ymin) / bb.height,
      },
    };
  }, [highlight]);

  /* ─── Layout helpers ────────────────────────────────────────────── */

  const pageWidth = 720 * zoom;

  const cursorClass =
    tool === "none"   ? "cursor-default"
    : tool === "eraser" ? "cursor-cell"
    : "cursor-crosshair";

  /* ─── Shared annotation overlay (used by both PDF pages and images) ── */

  const renderAnnotationOverlay = (pNum: number) => (
    <div
      className="absolute inset-0"
      style={{ touchAction: "none", userSelect: "none" }}
      onPointerDown={(e) => onPointerDown(e, pNum)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* SVG canvas for annotations */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1 1"
      >
        {[
          ...annotations.filter((a) => a.page === pNum),
          pNum === activePage ? drawing : null,
        ]
          .filter(Boolean)
          .map((a) => <AnnotationShape key={a!.id} a={a!} />)}
      </svg>

      {/* Field highlight from extraction results */}
      {hlByPage?.page === pNum && (
        <div
          className="pointer-events-none absolute animate-[pulse_2s_ease-in-out_infinite] rounded-sm border-2 border-dashed"
          style={{
            left:   `${hlByPage.rect.left   * 100}%`,
            top:    `${hlByPage.rect.top    * 100}%`,
            width:  `${hlByPage.rect.width  * 100}%`,
            height: `${hlByPage.rect.height * 100}%`,
            borderColor:     "#06b6d4",
            backgroundColor: "rgba(6,182,212,0.10)",
          }}
        />
      )}
    </div>
  );

  /* ─── Per-page renderer ─────────────────────────────────────────── */

  const renderPage = (pNum: number) => (
    <div
      key={pNum}
      id={`pdf-page-${pNum}`}
      className={`relative inline-block bg-white shadow-lg ${cursorClass}`}
    >
      <Page
        pageNumber={pNum}
        width={pageWidth}
        renderAnnotationLayer={false}
        renderTextLayer={false}
      />
      {renderAnnotationOverlay(pNum)}
    </div>
  );

  /* ─── Render ────────────────────────────────────────────────────── */

  return (
    <div className="flex h-full flex-col">

      {/* ── Compact Toolbar ── */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-card/60 px-3 py-1.5">

        {/* Page count */}
        {isPdf && (
          <span className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
            {numPages || "?"} pg
          </span>
        )}

        {/* Zoom */}
        <div className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="rounded p-0.5 hover:bg-muted"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[34px] text-center text-xs font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)))}
            className="rounded p-0.5 hover:bg-muted"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="rounded p-0.5 hover:bg-muted"
            title="Reset zoom"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>

        {/* Tool buttons — icon only, no labels */}
        <div className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
          {/* Select (no drawing) */}
          <button
            onClick={() => setTool("none")}
            title="Select — no drawing"
            className={`rounded p-1.5 transition-colors ${
              tool === "none"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
          </button>

          {TOOLS.map(([t, Icon, label]) => (
            <button
              key={t}
              onClick={() => setTool((cur) => (cur === t ? "none" : t))}
              title={label}
              className={`rounded p-1.5 transition-colors ${
                tool === t
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {/* Color swatches — no names, just circles */}
        <div className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5">
          {COLORS.map((c, i) => (
            <button
              key={c.name}
              onClick={() => setColorIdx(i)}
              title={c.name}
              className={`h-4 w-4 rounded-full border-2 transition-transform hover:scale-110 ${
                colorIdx === i ? "scale-110 border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        {/* Clear all annotations */}
        <button
          onClick={() => setAnnotations([])}
          title="Clear all annotations"
          className="ml-auto shrink-0 rounded-md border border-border bg-background p-1.5 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Scrollable PDF canvas — all pages stacked vertically ── */}
      <div className="relative flex-1 overflow-auto bg-muted/30" onWheel={onWheel}>
        <div className="flex flex-col items-center gap-4 p-4">
          {isPdf && (
            <Document
              file={file}
              onLoadSuccess={(d) => setNumPages(d.numPages)}
              loading={
                <div className="p-6 text-sm text-muted-foreground">Loading PDF…</div>
              }
              error={
                <div className="p-6 text-sm text-destructive">Failed to load PDF</div>
              }
            >
              {numPages > 0
                ? Array.from({ length: numPages }, (_, i) => renderPage(i + 1))
                : renderPage(1)}
            </Document>
          )}
          {isImage && (
            <div
              id="pdf-page-1"
              className={`relative inline-block bg-white shadow-lg ${cursorClass}`}
            >
              <img
                src={fileUrl}
                alt=""
                style={{ width: pageWidth, height: "auto", display: "block" }}
                draggable={false}
              />
              {renderAnnotationOverlay(1)}
            </div>
          )}
          {isText && (
            <div
              style={{ width: pageWidth }}
              className="bg-card p-4 text-xs shadow-lg"
            >
              <TextPreview file={file} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Annotation SVG shapes ──────────────────────────────────────────── */

function AnnotationShape({ a }: { a: Annotation }) {
  const minX  = Math.min(a.x1, a.x2);
  const minY  = Math.min(a.y1, a.y2);
  const width  = Math.abs(a.x2 - a.x1);
  const height = Math.abs(a.y2 - a.y1);


  if (a.tool === "highlight") {
    return (
      <rect
        x={minX} y={minY} width={width} height={height}
        fill={a.color}
        fillOpacity={0.20}           /* lighter than before (was 0.28) */
      />
    );
  }

  if (a.tool === "arrow") {
    const angle  = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const hLen   = 0.018;            /* smaller arrowhead */
    const hx1    = a.x2 - hLen * Math.cos(angle - Math.PI / 7);
    const hy1    = a.y2 - hLen * Math.sin(angle - Math.PI / 7);
    const hx2    = a.x2 - hLen * Math.cos(angle + Math.PI / 7);
    const hy2    = a.y2 - hLen * Math.sin(angle + Math.PI / 7);
    return (
      <g
        stroke={a.color}
        fill={a.color}
        strokeWidth={0.0015}         /* thinner line + head */
        vectorEffect="non-scaling-stroke"
      >
        <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />
        <polygon points={`${a.x2},${a.y2} ${hx1},${hy1} ${hx2},${hy2}`} />
      </g>
    );
  }

  return null;
}

/* ─── Plain-text file preview ────────────────────────────────────────── */

function TextPreview({ file }: { file: File }) {
  const [text, setText] = useState("Loading...");
  useEffect(() => {
    file.text().then(setText).catch(() => setText("(unable to read file)"));
  }, [file]);
  return <pre className="whitespace-pre-wrap font-mono">{text}</pre>;
}
