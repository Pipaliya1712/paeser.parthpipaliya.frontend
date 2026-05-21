export type DataType =
  | "string"
  | "integer"
  | "float"
  | "boolean"
  | "date"
  | "datetime"
  | "currency"
  | "email"
  | "phone"
  | "url"
  | "array"
  | "object";

export const DATA_TYPES: DataType[] = [
  "string",
  "integer",
  "float",
  "boolean",
  "date",
  "datetime",
  "currency",
  "email",
  "phone",
  "url",
  "array",
  "object",
];

export const PRIMITIVE_TYPES: DataType[] = DATA_TYPES.filter(
  (t) => t !== "array" && t !== "object",
);

export const CURRENCIES = ["USD", "INR", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY"];

export interface FieldExtra {
  date_format?: string;
  currency_country?: string;
  array_item_type?: DataType;
}

export interface SchemaField {
  id: string;
  key_name: string;
  data_type: DataType;
  required: boolean;
  description?: string;
  extra?: FieldExtra;
  children?: SchemaField[];
}

export interface SerializedField {
  key_name: string;
  data_type: DataType;
  required: boolean;
  description?: string;
  extra?: FieldExtra;
  children?: SerializedField[];
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  width: number;
  height: number;
}

export interface FieldDetail {
  key_name: string;
  value: unknown;
  confidence: number;
  location: {
    page_number: number;
    bounding_box: BoundingBox;
    text_snippet?: string;
  };
}

export interface ParseResponse {
  extracted_data: Record<string, unknown>;
  field_details: FieldDetail[];
  metadata: {
    filename: string;
    document_type: string;
    pages_processed: number;
    model_used: string;
    processing_time_seconds: number;
  };
}

let _idCounter = 0;
export const newId = () => `f_${Date.now()}_${_idCounter++}`;

export function serializeField(f: SchemaField): SerializedField {
  const out: SerializedField = {
    key_name: f.key_name,
    data_type: f.data_type,
    required: f.required,
  };
  if (f.description) out.description = f.description;
  if (f.extra && Object.keys(f.extra).length > 0) {
    const extra: FieldExtra = {};
    if ((f.data_type === "date" || f.data_type === "datetime") && f.extra.date_format)
      extra.date_format = f.extra.date_format;
    if (f.data_type === "currency" && f.extra.currency_country)
      extra.currency_country = f.extra.currency_country;
    if (f.data_type === "array" && f.extra.array_item_type)
      extra.array_item_type = f.extra.array_item_type;
    if (Object.keys(extra).length > 0) out.extra = extra;
  }
  if (f.children && f.children.length > 0)
    out.children = f.children.map(serializeField);
  return out;
}

export function deserializeField(s: SerializedField): SchemaField {
  return {
    id: newId(),
    key_name: s.key_name,
    data_type: s.data_type,
    required: s.required ?? true,
    description: s.description,
    extra: s.extra,
    children: s.children ? s.children.map(deserializeField) : undefined,
  };
}

export function validateSchemaJson(input: unknown): { ok: true; data: SerializedField[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(input)) {
    return { ok: false, errors: ["Schema must be a JSON array at the top level"] };
  }
  const walk = (node: unknown, path: string) => {
    if (typeof node !== "object" || node === null) {
      errors.push(`${path}: must be an object`);
      return;
    }
    const n = node as Record<string, unknown>;
    if (typeof n.key_name !== "string" || !n.key_name)
      errors.push(`${path}: missing or invalid key_name`);
    if (typeof n.data_type !== "string" || !DATA_TYPES.includes(n.data_type as DataType))
      errors.push(`${path}: invalid data_type "${String(n.data_type)}"`);
    const dt = n.data_type as DataType;
    if (dt === "object") {
      if (!Array.isArray(n.children) || n.children.length === 0)
        errors.push(`${path}: object type requires non-empty children`);
    }
    if (dt === "array") {
      const hasChildren = Array.isArray(n.children) && n.children.length > 0;
      const hasItemType =
        n.extra &&
        typeof n.extra === "object" &&
        typeof (n.extra as FieldExtra).array_item_type === "string";
      if (!hasChildren && !hasItemType)
        errors.push(`${path}: array type requires children or extra.array_item_type`);
    }
    if (dt !== "object" && dt !== "array" && n.children) {
      errors.push(`${path}: children only allowed for object or array types`);
    }
    if (Array.isArray(n.children)) {
      n.children.forEach((c, i) =>
        walk(c, `${path}.children[${i}](${n.key_name ?? "?"})`),
      );
    }
  };
  input.forEach((item, i) => walk(item, `[${i}]`));
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: input as SerializedField[] };
}
