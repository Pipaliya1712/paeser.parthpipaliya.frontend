import { X, Copy, Terminal, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ApiModal({ open, onClose }: Props) {
  if (!open) return null;

  // const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? window.location.origin;
  const apiBase = 'https://parser-parthpipaliya-backend.onrender.com'
  const endpoint = `${apiBase}/api/v1/parse-document`;
  const healthEndpoint = `${apiBase}/api/v1/health`;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };

  const curlExample = `curl -X POST "${endpoint}" \\
  -H "accept: application/json" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@your_document.pdf" \\
  -F 'schema_json=[
  {
    "key_name": "invoice_number",
    "data_type": "string",
    "required": true,
    "description": "The unique invoice number found at the top right"
  },
  {
    "key_name": "total_amount",
    "data_type": "currency"
  }
]'`;

  const responseExample = `{
  "extracted_data": {
    "invoice_number": "INV-2023-001",
    "total_amount": 1250.50
  },
  "field_details": [
    {
      "key_name": "invoice_number",
      "value": "INV-2023-001",
      "confidence": 98.5,
      "location": {
        "page_number": 1,
        "bounding_box": {
          "ymin": 45,
          "xmin": 300,
          "ymax": 60,
          "xmax": 450,
          "width": 150,
          "height": 15
        },
        "text_snippet": "Invoice # INV-2023-001"
      },
      "error": null
    }
  ],
  "metadata": {
    "filename": "your_document.pdf",
    "document_type": "application/pdf",
    "pages_processed": 1,
    "model_used": "gemini-1.5-pro",
    "processing_time_seconds": 2.4
  }
}`;

  const schemaExample = `[
  {
    "key_name": "invoice_number",
    "data_type": "string",
    "required": true,
    "description": "The unique invoice number found at the top right"
  },
  {
    "key_name": "total_amount",
    "data_type": "currency"
  },
  {
    "key_name": "status",
    "data_type": "enum",
    "extra": {
      "enum_values": ["PAID", "UNPAID", "OVERDUE"]
    }
  },
  {
    "key_name": "tags",
    "data_type": "array",
    "extra": {
      "array_item_type": "string"
    }
  },
  {
    "key_name": "line_items",
    "data_type": "array",
    "children": [
      {
        "key_name": "description",
        "data_type": "string"
      },
      {
        "key_name": "amount",
        "data_type": "float"
      }
    ]
  }
]`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 font-semibold">
            <Terminal className="h-4 w-4" />
            API Documentation
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-sm space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Document Parser API</h2>
            <p className="mt-2 text-muted-foreground">
              Extract structured data from any document using our AI parser. Use this API to integrate document extraction directly into your own applications.
            </p>
          </div>

          {/* Endpoints List */}
          <div className="space-y-6">
            
            {/* 1. Parse Document */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                <h3 className="text-lg font-semibold">Parse Document</h3>
              </div>
              <p className="text-muted-foreground">
                Extract structured data from a document using AI based on a provided JSON schema.
              </p>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs text-foreground flex items-center gap-2">
                  <span className="font-bold text-primary">POST</span>
                  {endpoint}
                </div>
                <div className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs text-foreground flex items-center gap-2">
                  <span className="text-muted-foreground">Content-Type:</span>
                  multipart/form-data
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Request Payload</h4>
                <p className="text-muted-foreground text-xs">The request must be sent as <code className="bg-muted px-1 py-0.5 rounded">multipart/form-data</code> with the following fields:</p>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 font-medium">Field</th>
                        <th className="px-4 py-2 font-medium">Type</th>
                        <th className="px-4 py-2 font-medium">Required</th>
                        <th className="px-4 py-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="px-4 py-2 font-mono text-primary">file</td>
                        <td className="px-4 py-2">File</td>
                        <td className="px-4 py-2"><span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Yes</span></td>
                        <td className="px-4 py-2 text-muted-foreground">The document to parse. Supported formats: PDF, PNG, JPG, JPEG, TXT, DOCX.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-mono text-primary">schema_json</td>
                        <td className="px-4 py-2">String</td>
                        <td className="px-4 py-2"><span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Yes</span></td>
                        <td className="px-4 py-2 text-muted-foreground">A JSON string defining the exact fields and types you want to extract from the document.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-mono text-primary">additional_info</td>
                        <td className="px-4 py-2">String</td>
                        <td className="px-4 py-2"><span className="inline-flex items-center rounded-full bg-muted-foreground/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">No</span></td>
                        <td className="px-4 py-2 text-muted-foreground">Optional additional context, instructions, or hints to help the parser understand the document.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="font-semibold text-foreground">Schema Definition (schema_json)</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  The <code className="bg-muted px-1 py-0.5 rounded text-foreground">schema_json</code> string must be a valid JSON array containing one or more field definition objects. Each object instructs the AI on what to extract.
                </p>
                <div className="rounded-md border border-border bg-card p-4 text-xs space-y-4">
                  <div>
                    <h5 className="font-semibold mb-2">Field Object Properties:</h5>
                    <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                      <li><strong className="text-foreground font-mono">key_name</strong> (string, required): The unique identifier for this field in the final extracted data.</li>
                      <li><strong className="text-foreground font-mono">data_type</strong> (string, required): The type of data to extract. See Supported Data Types below.</li>
                      <li><strong className="text-foreground font-mono">required</strong> (boolean, optional): Whether the parser must attempt to find this field. Defaults to <code className="bg-muted px-1 py-0.5 rounded text-foreground">true</code>.</li>
                      <li><strong className="text-foreground font-mono">description</strong> (string, optional): A description to help the AI understand what exactly to look for. Highly recommended for complex fields.</li>
                      <li>
                        <strong className="text-foreground font-mono">extra</strong> (object, optional): Additional configuration required for specific data types:
                        <ul className="list-circle pl-5 mt-1 space-y-1">
                          <li><code className="text-foreground">details</code> (string): Extra context.</li>
                          <li><code className="text-foreground">enum_values</code> (array of strings): <strong>Required</strong> if data_type is enum. Defines the allowed specific values.</li>
                          <li><code className="text-foreground">array_item_type</code> (string): <strong>Required</strong> if data_type is array and you are extracting a list of simple primitive values.</li>
                        </ul>
                      </li>
                      <li><strong className="text-foreground font-mono">children</strong> (array of Field Objects, optional): <strong>Required</strong> if data_type is object or array of objects. Defines nested schema fields.</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold mb-1">Supported Data Types:</h5>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {["string", "integer", "float", "boolean", "date", "time", "datetime", "currency", "email", "phone", "url", "enum", "array", "object"].map(t => (
                        <span key={t} className="inline-flex rounded-md bg-muted px-2 py-0.5 font-mono text-[10px]">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="flex items-center justify-between font-semibold mb-2 text-xs">
                    Example schema_json Payload
                    <button onClick={() => copyCode(schemaExample)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-md border border-border bg-[#1e1e1e] p-4 font-mono text-[11px] leading-relaxed text-gray-300">
                    {schemaExample}
                  </pre>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between font-semibold">
                  cURL Example
                  <button
                    onClick={() => copyCode(curlExample)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[10px] font-normal hover:bg-muted"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-md border border-border bg-[#1e1e1e] p-4 font-mono text-[11px] leading-relaxed text-gray-300">
                  {curlExample}
                </pre>
              </div>

              <div className="space-y-3 pt-4 border-t border-border/50">
                <h4 className="font-semibold text-foreground">Response Payload</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  The response is returned as a JSON object containing the extracted data, detailed information about each extracted field, and processing metadata.
                </p>
                <div className="flex items-center justify-between font-semibold text-xs mb-2">
                  Content-Type: application/json
                  <button onClick={() => copyCode(responseExample)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-md border border-border bg-[#1e1e1e] p-4 font-mono text-[11px] leading-relaxed text-gray-300">
                  {responseExample}
                </pre>
                
                <div className="rounded-md border border-border bg-card p-4 text-xs mt-4">
                  <h5 className="font-semibold mb-2">What the Response Indicates:</h5>
                  <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                    <li><strong className="text-foreground">extracted_data</strong>: A flattened dictionary containing the final extracted key-value pairs exactly matching the requested schema. Use this for direct integration.</li>
                    <li><strong className="text-foreground">field_details</strong>: A detailed breakdown of each requested field.
                      <ul className="list-circle pl-5 mt-1 space-y-1">
                        <li><code className="text-foreground">key_name</code> & <code className="text-foreground">value</code>: The specific field and its extracted value.</li>
                        <li><code className="text-foreground">confidence</code>: A score from 0 to 100 indicating how confident the parser is in the extraction.</li>
                        <li><code className="text-foreground">location</code>: Specifies exactly where the data was found in the document, including the page_number, exact pixel coordinates (bounding_box), and the surrounding text.</li>
                        <li><code className="text-foreground">error</code>: Populated with an error message if a specific field failed to be extracted.</li>
                      </ul>
                    </li>
                    <li><strong className="text-foreground">metadata</strong>: Contains high-level information about the processing job, such as the parsed filename, document type, number of pages, the AI model version used, and how long the parsing took.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 2. Health Check */}
            <section className="space-y-4 pt-6 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                <h3 className="text-lg font-semibold">Health Check</h3>
              </div>
              <p className="text-muted-foreground">
                Simple endpoint to verify if the API is running.
              </p>
              <div className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs text-foreground inline-flex items-center gap-2">
                <span className="font-bold text-success">GET</span>
                {healthEndpoint}
              </div>
              <div className="mt-4 space-y-2">
                <h4 className="font-semibold text-foreground text-xs">Response</h4>
                <pre className="overflow-x-auto rounded-md border border-border bg-[#1e1e1e] p-4 font-mono text-[11px] leading-relaxed text-gray-300">
                  {`{
  "status": "ok"
}`}
                </pre>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

