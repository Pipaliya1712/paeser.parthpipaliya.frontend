"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { validateSchemaJson, deserializeField, type SchemaField } from "@/lib/parser-types";

const EXAMPLE = `[
  {
    "key_name": "invoice_number",
    "data_type": "string",
    "required": true,
    "description": "The invoice number"
  },
  {
    "key_name": "total_amount",
    "data_type": "currency",
    "required": true,
    "extra": { "currency_country": "INR" }
  }
]`;

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (fields: SchemaField[]) => void;
}

export function PasteJsonModal({ open, onClose, onApply }: Props) {
  const [text, setText] = useState(EXAMPLE);
  const [errors, setErrors] = useState<string[]>([]);

  if (!open) return null;

  const handleApply = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setErrors([`Invalid JSON: ${(e as Error).message}`]);
      return;
    }
    const result = validateSchemaJson(parsed);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onApply(result.data.map(deserializeField));
    setErrors([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-sm font-semibold">Paste JSON Schema</h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            spellCheck={false}
            className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs outline-none focus:border-primary"
          />
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <div className="mb-1 font-semibold">Validation errors:</div>
              <ul className="ml-4 list-disc space-y-1">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Cancel</button>
            <button onClick={handleApply} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">Parse & Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}
