export type CsvImportPreview = {
  headers: string[];
  rows: Record<string, string>[];
  errors: Array<{ row: number; message: string }>;
};

const normalizeHeader = (value: string) =>
  value.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");

export function parseCsvRows(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function previewCsvImport(text: string, requiredHeaders: string[], maxRows = 1000): CsvImportPreview {
  const parsed = parseCsvRows(text);
  if (!parsed.length) throw new Error("The CSV file is empty.");
  const headers = parsed[0].map(normalizeHeader);
  if (headers.some((header) => !header)) throw new Error("Every CSV column must have a header.");
  if (new Set(headers).size !== headers.length) throw new Error("The CSV has duplicate column names after normalization.");

  const missing = requiredHeaders.map(normalizeHeader).filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required column(s): ${missing.join(", ")}.`);
  const sourceRows = parsed.slice(1);
  if (sourceRows.length > maxRows) throw new Error(`This import is limited to ${maxRows} data rows per file.`);

  const errors: CsvImportPreview["errors"] = [];
  const rows = sourceRows.map((values, index) => {
    if (values.length > headers.length) {
      errors.push({ row: index + 2, message: "This row has more values than the header row." });
    }
    if (values.length < headers.length) {
      errors.push({ row: index + 2, message: "This row has fewer values than the header row." });
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
  });
  return { headers, rows, errors };
}

export function validateCropImport(preview: CsvImportPreview): CsvImportPreview {
  const errors = [...preview.errors];
  preview.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (!row.name?.trim()) errors.push({ row: rowNumber, message: "Crop name is required." });
    if (row.plant_date && Number.isNaN(Date.parse(row.plant_date))) {
      errors.push({ row: rowNumber, message: "Plant date must be a valid date." });
    }
    const area = row.area_kanal ?? row.area_acres;
    if (area && (!Number.isFinite(Number(area)) || Number(area) < 0)) {
      errors.push({ row: rowNumber, message: "Area must be a non-negative number." });
    }
  });
  return { ...preview, errors };
}
