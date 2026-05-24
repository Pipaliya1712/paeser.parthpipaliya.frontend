import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileScan, Loader2, Moon, Sun, Code2,
  FileText, Sparkles, Database, BarChart2, Terminal
} from "lucide-react";
import { FileUpload } from "@/components/parser/FileUpload";
import { SchemaBuilder } from "@/components/parser/SchemaBuilder";
import { PasteJsonModal } from "@/components/parser/PasteJsonModal";
import { ApiModal } from "@/components/parser/ApiModal";
import { ResultsTree } from "@/components/parser/ResultsTree";
import {
  type SchemaField, type ParseResponse, type FieldDetail,
  serializeField, newId, validateFields,
} from "@/lib/parser-types";

// PDF.js depends on browser globals. Load only on the client.
const PdfViewer = lazy(() =>
  import("@/components/parser/PdfViewer").then((m) => ({ default: m.PdfViewer })),
);

export const Route = createFileRoute("/")(({
  component: ParserPage,
  head: () => ({
    meta: [
      { title: "Document Parser | Parth Pipaliya" },
      {
        name: "description",
        content:
          "Upload a document, define an extraction schema, and pinpoint each field on the page with interactive highlights and annotations.",
      },
    ],
  }),
}));

const DEFAULT_FIELDS: SchemaField[] = [
  { id: newId(), key_name: "invoice_number", data_type: "string", required: true, description: "The invoice number" },
  { id: newId(), key_name: "total_amount", data_type: "currency", required: true, extra: { currency_country: "INR" } },
];

function ParserPage() {
  const [file, setFile] = useState<File | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [fields, setFields] = useState<SchemaField[]>(() => {
    try {
      const saved = localStorage.getItem("parser-schema-draft");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return DEFAULT_FIELDS;
  });
  const [pasteOpen, setPasteOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ParseResponse | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<FieldDetail | null>(null);
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"schema" | "results">("schema");

  // Resizable divider state
  const [leftPct, setLeftPct] = useState(45);
  const [topHeight, setTopHeight] = useState(250);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isDraggingH = useRef(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("parser-schema-draft", JSON.stringify(fields));
  }, [fields]);

  // Auto-switch to results tab when extraction completes
  useEffect(() => {
    if (response) setActiveTab("results");
  }, [response]);

  // Divider drag handling
  const onDividerMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    e.preventDefault();
  };

  const onHDividerMouseDown = (e: React.MouseEvent) => {
    isDraggingH.current = true;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDragging.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        setLeftPct(Math.min(72, Math.max(24, pct)));
      }
      if (isDraggingH.current && leftColRef.current) {
        const rect = leftColRef.current.getBoundingClientRect();
        const topH = e.clientY - rect.top;
        setTopHeight(Math.max(100, Math.min(rect.height - 100, topH)));
      }
    };
    const onUp = () => { 
      isDragging.current = false; 
      isDraggingH.current = false; 
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleExtract = async () => {
    if (!file) { toast.error("Please upload a document first"); return; }
    if (fields.length === 0) { toast.error("Please define at least one field to extract"); return; }
    const errs = validateFields(fields);
    if (errs.length > 0) { toast.error(errs[0]); return; }

    setLoading(true);
    setResponse(null);
    setActiveHighlight(null);

    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? window.location.origin;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("schema_json", JSON.stringify(fields.map(serializeField)));
    if (additionalInfo) fd.append("additional_info", additionalInfo);

    try {
      const res = await fetch(`${apiBase}/api/v1/parse-document`, { method: "POST", body: fd });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try { const j = await res.json(); msg = j.detail || j.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const json: ParseResponse = await res.json();
      setResponse(json);
      const allNull = Object.values(json.extracted_data).every((v) => v === null || v === undefined);
      if (allNull) toast.warning("No data could be extracted from this document");
      else toast.success("Extraction complete");
    } catch (e) {
      const err = e as Error;
      if (err.message.includes("Failed to fetch")) {
        toast.error("Unable to connect to the server. Please check if the backend is running.");
      } else {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">

      {/* ── Header ── */}
      <header className="shrink-0 border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileScan className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">Document Parser</h1>
              <p className="text-[11px] text-muted-foreground">Schema-driven extraction with visual grounding</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setApiOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-muted"
            >
              <Terminal className="h-3.5 w-3.5" />
              API
            </button>
            <button
              onClick={() => setDark((d) => !d)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-muted"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {dark ? "Light" : "Dark"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 overflow-hidden p-4">
        <div ref={containerRef} className="mx-auto flex h-full max-w-[1600px]">

          {/* ───── LEFT: Upload + PDF Viewer ───── */}
          <div
            ref={leftColRef}
            style={{ width: `${leftPct}%` }}
            className="flex flex-col overflow-hidden pr-1"
          >
            {/* Upload card */}
            <div 
              style={{ height: `${topHeight}px` }}
              className="shrink-0 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <h2 className="mb-3 text-sm font-semibold">1. Upload Document</h2>
              <FileUpload
                file={file}
                onFileChange={setFile}
                additionalInfo={additionalInfo}
                onAdditionalInfoChange={setAdditionalInfo}
              />
            </div>

            {/* Horizontal Divider */}
            <div
              className="group flex h-3 shrink-0 cursor-row-resize items-center justify-center z-10"
              onMouseDown={onHDividerMouseDown}
              title="Drag to resize"
            >
              <div className="h-[3px] w-12 rounded-full bg-border transition-all duration-150 group-hover:h-1 group-hover:bg-primary/70 group-active:bg-primary" />
            </div>

            {/* PDF Viewer — fills remaining left column height */}
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {file && mounted ? (
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Loading viewer…
                    </div>
                  }
                >
                  <PdfViewer file={file} highlight={activeHighlight} />
                </Suspense>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
                    <FileScan className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">No document uploaded</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">Upload a file above to preview it here</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ───── Resizable Divider ───── */}
          <div
            className="group flex w-4 shrink-0 cursor-col-resize items-center justify-center"
            onMouseDown={onDividerMouseDown}
            title="Drag to resize"
          >
            <div className="h-12 w-[3px] rounded-full bg-border transition-all duration-150 group-hover:h-20 group-hover:bg-primary/70 group-active:bg-primary" />
          </div>

          {/* ───── RIGHT: Schema + Results Tabs ───── */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden pl-1">

            {/* Tab bar */}
            <div className="mb-3 flex shrink-0 gap-1 rounded-xl border border-border bg-muted/50 p-1 shadow-sm">
              <button
                onClick={() => setActiveTab("schema")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                  activeTab === "schema"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                Extraction Schema
              </button>
              <button
                onClick={() => setActiveTab("results")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                  activeTab === "results"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Results
                {/* Badge when new results and not on results tab */}
                {response && activeTab === "schema" && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 py-px text-[9px] font-bold text-primary-foreground">
                    NEW
                  </span>
                )}
              </button>
            </div>

            {/* ── Schema tab ── */}
            {activeTab === "schema" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
                  <h2 className="text-sm font-semibold">Define Fields</h2>
                  <button
                    onClick={() => setPasteOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    <Code2 className="h-3.5 w-3.5" /> Paste JSON
                  </button>
                </div>
                {/* Independently scrollable field list */}
                <div className="flex-1 overflow-y-auto p-4">
                  <SchemaBuilder fields={fields} onChange={setFields} />
                </div>
                {/* Extract button pinned at the bottom */}
                <div className="shrink-0 border-t border-border p-3">
                  <button
                    onClick={handleExtract}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:opacity-90 disabled:opacity-60"
                  >
                    {loading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting data…</>
                      : <><Sparkles className="h-4 w-4" /> Extract Data</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* ── Results tab ── */}
            {activeTab === "results" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {response ? (
                  <ResultsTree
                    response={response}
                    activeKey={activeHighlight?.key_name ?? null}
                    onPinClick={(d) =>
                      setActiveHighlight((cur) => cur?.key_name === d.key_name ? null : d)
                    }
                  />
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/50">
                      <FileText className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">No results yet</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/70">
                        Switch to the <strong className="font-semibold text-foreground/60">Schema</strong> tab,
                        define your fields,<br />then click <strong className="font-semibold text-foreground/60">Extract Data</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("schema")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
                    >
                      <Database className="h-3.5 w-3.5" /> Go to Schema
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="shrink-0 border-t border-border bg-card/40 py-2.5">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 px-4 sm:flex-row text-[11px] text-muted-foreground">
          <div>
            All rights reserved to <a href="https://parthpipaliya.com" target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">parthpipaliya.com</a> &copy; 2026-27
          </div>
          <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-center">
            <a href="https://parthpipaliya.com" target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">Portfolio</a>
            <span className="hidden sm:inline text-border">|</span>
          </div>
        </div>
      </footer>

      <PasteJsonModal open={pasteOpen} onClose={() => setPasteOpen(false)} onApply={setFields} />
      <ApiModal open={apiOpen} onClose={() => setApiOpen(false)} />
    </div>
  );
}
