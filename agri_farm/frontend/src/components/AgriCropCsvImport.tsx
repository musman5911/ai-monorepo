import React, { useState } from "react";
import { parseXlsxRows, previewCsvImport, rowsToCsv, validateCropImport } from "./app/agriBulkImport";

type CropImportRow = Record<string, string>;
type Props = {
  onImportRows: (rows: CropImportRow[]) => Promise<void>;
};

const REQUIRED_COLUMNS = ["name"];
const ALLOWED_COLUMNS = new Set([
  "name", "variety", "status", "plant_date", "harvest_date", "field",
  "yield_kg", "yield_unit", "area_kanal", "area_acres", "notes", "season", "crop_year",
]);

export default function AgriCropCsvImport({ onImportRows }: Props) {
  const [preview, setPreview] = useState<ReturnType<typeof validateCropImport> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  const loadFile = async (file?: File) => {
    setError("");
    setPreview(null);
    setFileName("");
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      setError("Choose a CSV file or an Excel .xlsx workbook.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Import files must be 5 MB or smaller.");
      return;
    }
    try {
      const rows = name.endsWith(".xlsx")
        ? await parseXlsxRows(await file.arrayBuffer())
        : undefined;
      const text = rows ? rowsToCsv(rows) : await file.text();
      const parsed = validateCropImport(previewCsvImport(text, REQUIRED_COLUMNS, 1000));
      const unsupported = parsed.headers.filter((header) => !ALLOWED_COLUMNS.has(header));
      if (unsupported.length) {
        setError(`Unsupported column(s): ${unsupported.join(", ")}. Remove them or rename them to supported crop fields.`);
        return;
      }
      setFileName(file.name);
      setPreview(parsed);
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
      setError(err instanceof Error ? err.message : "Import failed. Review the farm connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <div>
        <h3 className="font-bold">Preview Crop CSV / Excel Import</h3>
        <p className="text-xs opacity-70">CSV or first worksheet of an .xlsx workbook, up to 1,000 rows and 5 MB. Nothing is saved until you confirm a valid preview.</p>
      </div>
      <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(event) => void loadFile(event.target.files?.[0])} />
      {fileName && <p className="text-xs">File: {fileName}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {preview && (
        <>
          <p className="text-sm">{preview.rows.length} row(s) parsed, {preview.errors.length} validation error(s).</p>
          {preview.errors.length > 0 && (
            <ul className="max-h-32 overflow-auto text-xs text-red-600 list-disc pl-5">
              {preview.errors.slice(0, 20).map((item, index) => <li key={index}>Row {item.row}: {item.message}</li>)}
              {preview.errors.length > 20 && <li>And {preview.errors.length - 20} more error(s).</li>}
            </ul>
          )}
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-xs">
              <thead><tr>{preview.headers.map((header) => <th key={header} className="p-2 text-left">{header}</th>)}</tr></thead>
              <tbody>
                {preview.rows.slice(0, 20).map((row, index) => (
                  <tr key={index} className="border-t border-slate-200 dark:border-slate-700">
                    {preview.headers.map((header) => <td key={header} className="p-2">{row[header]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy || preview.errors.length > 0 || !preview.rows.length} onClick={() => void confirmImport()} className="muf-primary-action small">
              {busy ? "Importing…" : `Import ${preview.rows.length} Crops`}
            </button>
            <button type="button" disabled={busy} onClick={() => { setPreview(null); setFileName(""); setError(""); }} className="rounded-xl border px-4 py-2 text-xs">Clear preview</button>
          </div>
        </>
      )}
    </div>
  );
}
