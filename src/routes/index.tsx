import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileScan, Loader2, Moon, Sun, Code2 } from "lucide-react";
import { FileUpload } from "@/components/parser/FileUpload";
import { SchemaBuilder } from "@/components/parser/SchemaBuilder";
import { PasteJsonModal } from "@/components/parser/PasteJsonModal";
import { ResultsTree } from "@/components/parser/ResultsTree";
import {
  type SchemaField, type ParseResponse, type FieldDetail,
  serializeField, newId, validateFields,
} from "@/lib/parser-types";

// PDF.js depends on browser globals (DOMMatrix). Load only on the client.
const PdfViewer = lazy(() =>
  import("@/components/parser/PdfViewer").then((m) => ({ default: m.PdfViewer })),
);

export const Route = createFileRoute("/")({
  component: ParserPage,
  head: () => ({
    meta: [
      { title: "Document Parser — Extract structured data from any document" },
      { name: "description", content: "Upload a document, define an extraction schema, and pinpoint each field on the page with interactive highlights and annotations." },
    ],
  }),
});

const DEFAULT_FIELDS: SchemaField[] = [
  { id: newId(), key_name: "invoice_number", data_type: "string", required: true, description: "The invoice number" },
  { id: newId(), key_name: "total_amount", data_type: "currency", required: true, extra: { currency_country: "INR" } },
];

function ParserPage() {
  const [file, setFile] = useState<File | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [fields, setFields] = useState<SchemaField[]>(DEFAULT_FIELDS);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ParseResponse | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<FieldDetail | null>(null);
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const handleExtract = async () => {
    if (!file) { toast.error("Please upload a document first"); return; }
    if (fields.length === 0) { toast.error("Please define at least one field to extract"); return; }
    const errs = validateFields(fields);
    if (errs.length > 0) { toast.error(errs[0]); return; }

    setLoading(true);
    setResponse(null);
    setActiveHighlight(null);

    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/70 backdrop-blur">
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
          <button
            onClick={() => setDark((d) => !d)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-muted"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {dark ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-12">
        {/* LEFT: Upload + PDF preview */}
        <section className="space-y-4 lg:col-span-6">
          <Card title="1. Upload Document">
            <FileUpload
              file={file}
              onFileChange={setFile}
              additionalInfo={additionalInfo}
              onAdditionalInfoChange={setAdditionalInfo}
            />
          </Card>

          <div className="h-[calc(100vh-22rem)] min-h-[420px] overflow-hidden rounded-xl border border-border bg-card">
            {file && mounted ? (
              <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading viewer…</div>}>
                <PdfViewer file={file} highlight={activeHighlight} />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <FileScan className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">Document preview will appear here</p>
                  <p className="mt-1 text-xs text-muted-foreground">Upload a file above to get started</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: Fields + Results */}
        <section className="space-y-4 lg:col-span-6">
          <Card
            title="2. Extraction Schema"
            action={
              <button
                onClick={() => setPasteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
              >
                <Code2 className="h-3.5 w-3.5" /> Paste JSON
              </button>
            }
          >
            <SchemaBuilder fields={fields} onChange={setFields} />
          </Card>

          <button
            onClick={handleExtract}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 disabled:opacity-60"
          >
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Extracting data from document…</>) : "Extract Data"}
          </button>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {response ? (
              <div className="max-h-[60vh]">
                <ResultsTree
                  response={response}
                  activeKey={activeHighlight?.key_name ?? null}
                  onPinClick={(d) => setActiveHighlight((cur) => cur?.key_name === d.key_name ? null : d)}
                />
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                3. Results will appear here after extraction.
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/40 py-3">
        <div className="mx-auto max-w-[1600px] px-4 text-center text-[11px] text-muted-foreground">
          API: {(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000"} · POST /api/v1/parse-document
        </div>
      </footer>

      <PasteJsonModal open={pasteOpen} onClose={() => setPasteOpen(false)} onApply={setFields} />
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
