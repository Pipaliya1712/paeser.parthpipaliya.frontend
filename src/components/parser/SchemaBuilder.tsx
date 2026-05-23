"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight, Asterisk,
} from "lucide-react";
import {
  type SchemaField, type DataType,
  DATA_TYPES, DATA_TYPE_META, PRIMITIVE_TYPES, newId,
  serializeField, deserializeField, validateSchemaJson,
} from "@/lib/parser-types";

interface Props {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
}

function makeField(): SchemaField {
  return { id: newId(), key_name: "", data_type: "string", required: true };
}

export function SchemaBuilder({ fields, onChange }: Props) {
  const [rawMode, setRawMode] = useState(false);

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">
          {fields.length} field{fields.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <span>Raw JSON</span>
            <span className="relative inline-flex h-5 w-9 items-center">
              <input
                type="checkbox"
                checked={rawMode}
                onChange={(e) => setRawMode(e.target.checked)}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded-full bg-muted transition-colors duration-200 peer-checked:bg-primary" />
              <span className="relative left-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform duration-200 peer-checked:translate-x-4" />
            </span>
          </label>
          {!rawMode && (
            <button
              onClick={() => onChange([...fields, makeField()])}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Add Field
            </button>
          )}
        </div>
      </div>

      {rawMode ? (
        <RawJsonEditor fields={fields} onChange={onChange} />
      ) : (
        <div className="space-y-2">
          {fields.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
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
      )}
    </div>
  );
}

/* ------------------------- Raw JSON editor (live sync) ------------------------- */

function RawJsonEditor({ fields, onChange }: Props) {
  const serialized = useMemo(
    () => JSON.stringify(fields.map(serializeField), null, 2),
    [fields],
  );
  const [text, setText] = useState(serialized);
  const [error, setError] = useState<string | null>(null);

  // Keep textarea in sync when fields change externally
  useEffect(() => {
    setText(serialized);
    setError(null);
  }, [serialized]);

  const apply = (val: string) => {
    setText(val);
    try {
      const parsed = JSON.parse(val);
      const res = validateSchemaJson(parsed);
      if (!res.ok) {
        setError(res.errors[0]);
        return;
      }
      setError(null);
      onChange(res.data.map(deserializeField));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => apply(e.target.value)}
        spellCheck={false}
        rows={18}
        className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs outline-none focus:border-primary"
      />
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

/* ------------------------- Field row (compact + edit mode) ------------------------- */

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
  const [editing, setEditing] = useState(field.key_name === "");
  const [open, setOpen] = useState(true);
  const meta = DATA_TYPE_META[field.data_type];
  const Icon = meta.icon;
  const isContainer = field.data_type === "object" || field.data_type === "array";

  return (
    <div
      className="rounded-lg border border-border bg-card"
      style={depth > 0 ? { borderLeftColor: "var(--primary)", borderLeftWidth: 3 } : undefined}
    >
      {/* Compact summary header */}
      <div className="flex items-center gap-2 p-2.5">
        {isContainer ? (
          <button onClick={() => setOpen((v) => !v)} className="text-muted-foreground hover:text-foreground">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"
          title={meta.label}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-mono text-sm font-medium">
              {field.key_name || <span className="italic text-muted-foreground">unnamed</span>}
            </span>
            {field.required && (
              <Asterisk className="h-3 w-3 text-destructive" aria-label="required" />
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{meta.label}</span>
            {field.description && <span className="truncate">· {field.description}</span>}
            {field.data_type === "currency" && field.extra?.currency_country && (
              <span>· {field.extra.currency_country}</span>
            )}
            {(field.data_type === "date" || field.data_type === "datetime" || field.data_type === "time") && field.extra?.date_format && (
              <span>· {field.extra.date_format}</span>
            )}
            {field.data_type === "enum" && field.extra?.enum_values?.length ? (
              <span className="truncate">· {field.extra.enum_values.join(", ")}</span>
            ) : null}
          </div>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className={`rounded-md p-1.5 transition-colors ${editing ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          aria-label={editing ? "Done editing" : "Edit field"}
          title={editing ? "Done" : "Edit"}
        >
          {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </button>
        <button
          onClick={onRemove}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete field"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="border-t border-border bg-muted/30 p-3">
          <FieldEditForm field={field} onUpdate={onUpdate} />
        </div>
      )}

      {/* Children */}
      {isContainer && open && (
        <div className="space-y-2 border-t border-border bg-muted/10 p-3 pl-6">
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

/* ------------------------- Field edit form ------------------------- */

function FieldEditForm({ field, onUpdate }: { field: SchemaField; onUpdate: (p: Partial<SchemaField>) => void }) {
  return (
    <div className="grid grid-cols-12 gap-2">
      <div className="col-span-12 md:col-span-6">
        <Label>Key Name</Label>
        <input
          value={field.key_name}
          onChange={(e) => onUpdate({ key_name: e.target.value })}
          placeholder="field_name"
          className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono outline-none focus:border-primary"
        />
      </div>
      <div className="col-span-7 md:col-span-4">
        <Label>Data Type</Label>
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
          {DATA_TYPES.map((t) => (
            <option key={t} value={t}>{DATA_TYPE_META[t].label}</option>
          ))}
        </select>
      </div>
      <div className="col-span-5 md:col-span-2 flex flex-col">
        <Label>Required</Label>
        <label className="mt-1 inline-flex cursor-pointer items-center">
          <span className="relative inline-flex h-5 w-9 items-center">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-muted transition-colors duration-200 peer-checked:bg-primary" />
            <span className="relative left-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform duration-200 peer-checked:translate-x-4" />
          </span>
        </label>
      </div>
      <div className="col-span-12">
        <Label>Description</Label>
        <input
          value={field.description ?? ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Optional description"
          className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
        />
      </div>

      {/* Extras */}
      {(field.data_type === "date" || field.data_type === "datetime" || field.data_type === "time") && (
        <div className="col-span-12">
          <Label>Date / Time Format</Label>
          <input
            value={field.extra?.date_format ?? ""}
            onChange={(e) => onUpdate({ extra: { ...field.extra, date_format: e.target.value } })}
            placeholder="e.g. %Y-%m-%d, DD/MM/YYYY, HH:mm — free text"
            className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
          />
        </div>
      )}
      {field.data_type === "currency" && (
        <div className="col-span-12">
          <Label>Currency Code</Label>
          <input
            value={field.extra?.currency_country ?? ""}
            onChange={(e) => onUpdate({ extra: { ...field.extra, currency_country: e.target.value } })}
            placeholder="e.g. INR, USD, EUR — free text"
            className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs uppercase font-mono outline-none focus:border-primary"
          />
        </div>
      )}
      {field.data_type === "array" && (
        <div className="col-span-12">
          <Label>List Item Type (if not using children)</Label>
          <select
            value={field.extra?.array_item_type ?? ""}
            onChange={(e) => onUpdate({ extra: { ...field.extra, array_item_type: (e.target.value || undefined) as DataType | undefined } })}
            className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
          >
            <option value="">— none —</option>
            {PRIMITIVE_TYPES.map((t) => <option key={t} value={t}>{DATA_TYPE_META[t].label}</option>)}
          </select>
        </div>
      )}
      {field.data_type === "enum" && (
        <div className="col-span-12">
          <Label>
            Enum Values <span className="text-destructive">*</span>
          </Label>
          <EnumValuesInput
            values={field.extra?.enum_values ?? []}
            onChange={(v) => onUpdate({ extra: { ...field.extra, enum_values: v } })}
          />
          <div className="mt-1 text-[10px] text-muted-foreground">Press Enter or comma to add a value. At least one required.</div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">{children}</label>;
}

function EnumValuesInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 focus-within:border-primary">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">
          {v}
          <button
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
            aria-label={`Remove ${v}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => {
          const val = e.target.value;
          if (val.endsWith(",")) {
            setDraft(val.slice(0, -1));
            setTimeout(commit, 0);
          } else setDraft(val);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={values.length ? "" : "active, pending, closed"}
        className="min-w-[80px] flex-1 bg-transparent text-xs outline-none"
      />
    </div>
  );
}
