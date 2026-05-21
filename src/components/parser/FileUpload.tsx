"use client";
import { useCallback, useRef, useState } from "react";
import { Upload, FileText, X, Image as ImageIcon } from "lucide-react";

const ACCEPTED = [".pdf", ".png", ".jpg", ".jpeg", ".txt", ".docx"];
const ACCEPT_ATTR = ACCEPTED.join(",");

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface Props {
  file: File | null;
  onFileChange: (f: File | null) => void;
  additionalInfo: string;
  onAdditionalInfoChange: (s: string) => void;
}

export function FileUpload({ file, onFileChange, additionalInfo, onAdditionalInfoChange }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      import("sonner").then(({ toast }) =>
        toast.error("Unsupported file type. Please upload PDF, PNG, JPG, JPEG, TXT, or DOCX"),
      );
      return;
    }
    onFileChange(f);
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    if (f.type.startsWith("image/")) setThumbUrl(URL.createObjectURL(f));
    else setThumbUrl(null);
  }, [onFileChange, thumbUrl]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const clearFile = () => {
    onFileChange(null);
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    setThumbUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`w-full rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragOver ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-accent/40"
          }`}
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-2 text-sm font-medium">Drop a document here or click to browse</div>
          <div className="mt-1 text-xs text-muted-foreground">PDF, PNG, JPG, JPEG, TXT, DOCX</div>
        </button>
      ) : (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-start gap-3">
            {thumbUrl ? (
              <img src={thumbUrl} alt="" className="h-14 w-14 rounded-md object-cover border border-border" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-accent text-accent-foreground">
                {file.type.startsWith("image/") ? <ImageIcon className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{file.name}</div>
              <div className="text-xs text-muted-foreground">{formatSize(file.size)}</div>
            </div>
            <button onClick={clearFile} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Remove file">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <div>
        <label className="text-xs font-medium text-muted-foreground">Additional information (optional)</label>
        <textarea
          value={additionalInfo}
          onChange={(e) => onAdditionalInfoChange(e.target.value)}
          rows={2}
          placeholder="e.g., This is a vendor invoice from Q4 2024"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
        />
      </div>
    </div>
  );
}
