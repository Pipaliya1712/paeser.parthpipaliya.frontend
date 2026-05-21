"use client";
import { useState } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  type SchemaField, type DataType,
  DATA_TYPES, PRIMITIVE_TYPES, CURRENCIES, newId,
} from "@/lib/parser-types";

interface Props {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
}

function makeField(): SchemaField {
  return { id: newId(), key_name: "", data_type: "string", required: true };
}

export function SchemaBuilder({ fields, onChange }: Props) {
  const update = (id: string, patch: Partial<SchemaField>, list = fields): SchemaField[] =>
    list.map((f) => {
      if (f.id === id) return { ...f, ...patch };
      if (f.children) return { ...f, children: update(id, patch, f.children) };
      return f;
    });

  const remove = (id: string, list = fields): SchemaField[] =>
    list
      .filter((f) => f.id !== id)
      .map((f) => (f.children ? { ...f, children: remove(id, f.children) } : f));

  const addChild = (parentId: string, list = fields): SchemaField[] =>
    list.map((f) => {
      if (f.id === parentId) {
        return { ...f, children: [...(f.children ?? []), makeField()] };
      }
      if (f.children) return { ...f, children: addChild(parentId, f.children) };
      return f;
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">
          {fields.length} field{fields.length === 1 ? "" : "s"}
        </div>
        <button
          onClick={() => onChange([...fields, makeField()])}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Add Field
        </button>
      </div>
      <div className="space-y-2">
        {fields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No fields yet. Click "Add Field" or paste a JSON schema.
          </div>
        ) : (
          fields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              depth={0}
              onUpdate={(patch) => onChange(update(f.id, patch))}
              onRemove={() => onChange(remove(f.id))}
              onAddChild={() => onChange(addChild(f.id))}
              onChildUpdate={(id, patch) => onChange(update(id, patch))}
              onChildRemove={(id) => onChange(remove(id))}
              onChildAddChild={(id) => onChange(addChild(id))}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface RowProps {
  field: SchemaField;
  depth: number;
  onUpdate: (patch: Partial<SchemaField>) => void;
  onRemove: () => void;
  onAddChild: () => void;
  onChildUpdate: (id: string, patch: Partial<SchemaField>) => void;
  onChildRemove: (id: string) => void;
  onChildAddChild: (id: string) => void;
}

function FieldRow({
  field, depth, onUpdate, onRemove, onAddChild,
  onChildUpdate, onChildRemove, onChildAddChild,
}: RowProps) {
  const [open, setOpen] = useState(true);
  const isContainer = field.data_type === "object" || field.data_type === "array";
  const showExtra =
    field.data_type === "date" ||
    field.data_type === "datetime" ||
    field.data_type === "currency" ||
    field.data_type === "array";

  return (
    <div
      className="rounded-lg border border-border bg-card p-3"
      style={depth > 0 ? { borderLeftColor: "var(--primary)", borderLeftWidth: 3 } : undefined}
    >
      <div className="flex items-start gap-2">
        {isContainer && (
          <button onClick={() => setOpen((v) => !v)} className="mt-1 text-muted-foreground hover:text-foreground">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
        <div className="grid flex-1 grid-cols-12 gap-2">
          <div className="col-span-12 md:col-span-5">
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">key_name</label>
            <input
              value={field.key_name}
              onChange={(e) => onUpdate({ key_name: e.target.value })}
              placeholder="field_name"
              className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono outline-none focus:border-primary"
            />
          </div>
          <div className="col-span-7 md:col-span-4">
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">data_type</label>
            <select
              value={field.data_type}
              onChange={(e) => {
                const dt = e.target.value as DataType;
                const patch: Partial<SchemaField> = { data_type: dt };
                if (dt !== "object" && dt !== "array") patch.children = undefined;
                onUpdate(patch);
              }}
              className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
            >
              {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-5 md:col-span-3 flex flex-col">
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">required</label>
            <label className="mt-1 inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onUpdate({ required: e.target.checked })}
                className="peer sr-only"
              />
              <span className="relative inline-block h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-primary">
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background transition-transform peer-checked:translate-x-4" />
              </span>
              <span className="ml-2 text-xs text-muted-foreground">{field.required ? "Yes" : "No"}</span>
            </label>
          </div>
          <div className="col-span-12">
            <input
              value={field.description ?? ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Description (optional)"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>
          {showExtra && (
            <div className="col-span-12 rounded-md bg-muted/50 p-2">
              {(field.data_type === "date" || field.data_type === "datetime") && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">date_format</label>
                  <input
                    value={field.extra?.date_format ?? ""}
                    onChange={(e) => onUpdate({ extra: { ...field.extra, date_format: e.target.value } })}
                    placeholder="e.g. %Y-%m-%d"
                    className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono outline-none focus:border-primary"
                  />
                </div>
              )}
              {field.data_type === "currency" && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">currency_country</label>
                  <select
                    value={field.extra?.currency_country ?? "USD"}
                    onChange={(e) => onUpdate({ extra: { ...field.extra, currency_country: e.target.value } })}
                    className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {field.data_type === "array" && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">array_item_type (if not using children)</label>
                  <select
                    value={field.extra?.array_item_type ?? ""}
                    onChange={(e) => onUpdate({ extra: { ...field.extra, array_item_type: (e.target.value || undefined) as DataType | undefined } })}
                    className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                  >
                    <option value="">— none —</option>
                    {PRIMITIVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
        <button onClick={onRemove} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete field">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {isContainer && open && (
        <div className="mt-3 space-y-2 pl-4">
          {field.children?.map((c) => (
            <FieldRow
              key={c.id}
              field={c}
              depth={depth + 1}
              onUpdate={(p) => onChildUpdate(c.id, p)}
              onRemove={() => onChildRemove(c.id)}
              onAddChild={() => onChildAddChild(c.id)}
              onChildUpdate={onChildUpdate}
              onChildRemove={onChildRemove}
              onChildAddChild={onChildAddChild}
            />
          ))}
          <button
            onClick={onAddChild}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-3 w-3" /> Add Child
          </button>
        </div>
      )}
    </div>
  );
}
