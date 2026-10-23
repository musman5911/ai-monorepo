import React, { useState } from "react";
import { parseXlsxRows, previewCsvImport, rowsToCsv } from "./app/agriBulkImport";

type ImportKind = "tasks" | "finance";
type ImportRow = Record<string, string>;
type Props = {
  kind: ImportKind;
  onImportRows: (rows: ImportRow[]) => Promise<void>;
};

const CONFIG: Record<ImportKind, { title: string; required: string[]; allowed: Set<string>; help: string }> = {
  tasks: {
    title: "Task",
    required: ["title"],
    allowed: new Set(["title", "due_date", "assigned_to", "priority", "notes", "labor_cost", "crop_id", "inventory_item_id", "inventory_qty_consumed"]),
    help: "Supported columns: title, due_date, assigned_to, priority, notes, labor_cost, crop_id, inventory_item_id, inventory_qty_consumed.",
  },
  finance: {
    title: "Finance",
    required: ["category", "amount"],
    allowed: new Set(["category", "amount", "type", "date", "crop_id", "notes"]),
    help: "Supported columns: category, amount, type, date, crop_id, notes. Type must be income or expense.",
  },
};

function validateRows(kind: ImportKind, rows: ImportRow[]) {
  const errors: Array<{ row: number; message: string }> = [];
  rows.forEach((row, index) => {
    const number = index + 2;
    const numeric = (key: string, required = false) => {
      const value = row[key]?.trim() ?? "";
      if (!value && !required) return;
      if (!Number.isFinite(Number(value)) || Number(value) < 0) errors.push({ row: number, message: `${key} must be a non-negative number.` });
    };
    if (kind === "tasks") {
      if (!row.title?.trim()) errors.push({ row: number, message: "Task title is required." });
      if (row.due_date && Number.isNaN(Date.parse(row.due_date))) errors.push({ row: number, message: "Due date must be valid." });
      if (row.priority && !["low", "medium", "high"].includes(row.priority.toLowerCase())) errors.push({ row: number, message: "Priority must be Low, Medium, or High." });
      numeric("labor_cost");
      numeric("inventory_qty_consumed");
    } else {
      if (!row.category?.trim()) errors.push({ row: number, message: "Category is required." });
      numeric("amount", true);
      if (row.type && !["income", "expense"].includes(row.type.toLowerCase())) errors.push({ row: number, message: "Type must be income or expense." });
      if (row.date && Number.isNaN(Date.parse(row.date))) errors.push({ row: number, message: "Date must be valid." });
    }
  });
  return errors;
}

export default function AgriBulkCsvImport({ kind, onImportRows }: Props) {
  const config = CONFIG[kind];
  const [preview, setPreview] = useState<{ headers: string[]; rows: ImportRow[]; errors: Array<{ row: number; message: string }> } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  const loadFile = async (file?: File) => {
    setError("");
    setPreview(null);
    setFileName("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && !file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Choose a CSV file or an Excel .xlsx workbook.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Import files must be 5 MB or smaller.");
      return;
    }
    try {
      const workbookRows = file.name.toLowerCase().endsWith(".xlsx") ? await parseXlsxRows(await file.arrayBuffer()) : null;
      const parsed = previewCsvImport(workbookRows ? rowsToCsv(workbookRows) : await file.text(), config.required, 1000);
      const unsupported = parsed.headers.filter((header) => !config.allowed.has(header));
      if (unsupported.length) throw new Error(`Unsupported column(s): ${unsupported.join(", ")}.`);
      const errors = [...parsed.errors, ...validateRows(kind, parsed.rows)];
      setPreview({ ...parsed, errors });
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this import file.");
    }
  };

  const confirmImport = async () => {
    if (!preview || preview.errors.length || !preview.rows.length || busy) return;
    setBusy(true);
    setError("");
    try {
      await onImportRows(preview.rows);
      setPreview(null);
      setFileName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <div>
        <h3 className="font-bold">Preview {config.title} CSV / Excel Import</h3>
        <p className="text-xs opacity-70">{config.help} Up to 1,000 rows and 5 MB. The import is validated before any records are written.</p>
      </div>
      <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(event) => void loadFile(event.target.files?.[0])} />
      {fileName && <p className="text-xs">File: {fileName}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {preview && <>
        <p className="text-sm">{preview.rows.length} row(s), {preview.errors.length} validation error(s).</p>
        {preview.errors.length > 0 && <ul className="max-h-32 overflow-auto text-xs text-red-600 list-disc pl-5">
          {preview.errors.slice(0, 20).map((item, index) => <li key={index}>Row {item.row}: {item.message}</li>)}
          {preview.errors.length > 20 && <li>And {preview.errors.length - 20} more error(s).</li>}
        </ul>}
        <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-xs">
            <thead><tr>{preview.headers.map((header) => <th key={header} className="p-2 text-left">{header}</th>)}</tr></thead>
            <tbody>{preview.rows.slice(0, 20).map((row, index) => <tr key={index} className="border-t border-slate-200 dark:border-slate-700">
              {preview.headers.map((header) => <td key={header} className="p-2">{row[header]}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy || preview.errors.length > 0 || !preview.rows.length} onClick={() => void confirmImport()} className="muf-primary-action small">
            {busy ? "Importing…" : `Import ${preview.rows.length} ${config.title} records`}
          </button>
          <button type="button" disabled={busy} onClick={() => { setPreview(null); setFileName(""); setError(""); }} className="rounded-xl border px-4 py-2 text-xs">Clear preview</button>
        </div>
      </>}
    </section>
  );
}
