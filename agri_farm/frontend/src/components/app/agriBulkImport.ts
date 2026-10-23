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


// Read the first worksheet from a modern XLSX workbook without adding a large
// runtime dependency. XLSX is a ZIP container; browser-native decompression and
// XML parsing keep the implementation self-contained. Unsupported ZIP methods,
// corrupt archives, encrypted files, and malformed XML fail closed.
export async function parseXlsxRows(buffer: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length > 5 * 1024 * 1024) throw new Error("XLSX files must be 5 MB or smaller.");
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50) {
    throw new Error("This file is not a valid XLSX workbook.");
  }

  let endRecord = -1;
  const searchStart = Math.max(0, bytes.length - 22 - 65535);
  for (let offset = bytes.length - 22; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { endRecord = offset; break; }
  }
  if (endRecord < 0) throw new Error("The XLSX archive directory is missing or corrupt.");
  const entryCount = view.getUint16(endRecord + 10, true);
  if (entryCount > 2048) throw new Error("The XLSX archive contains too many files.");
  let directoryOffset = view.getUint32(endRecord + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, { method: number; compressedSize: number; uncompressedSize: number; localOffset: number }>();

  for (let index = 0; index < entryCount; index += 1) {
    if (directoryOffset + 46 > endRecord || view.getUint32(directoryOffset, true) !== 0x02014b50) {
      throw new Error("The XLSX archive contains a malformed directory entry.");
    }
    const method = view.getUint16(directoryOffset + 10, true);
    const compressedSize = view.getUint32(directoryOffset + 20, true);
    const uncompressedSize = view.getUint32(directoryOffset + 24, true);
    if (uncompressedSize > 10 * 1024 * 1024) throw new Error("An XLSX workbook entry exceeds the 10 MB decompressed limit.");
    const nameLength = view.getUint16(directoryOffset + 28, true);
    const extraLength = view.getUint16(directoryOffset + 30, true);
    const commentLength = view.getUint16(directoryOffset + 32, true);
    const localOffset = view.getUint32(directoryOffset + 42, true);
    const nameStart = directoryOffset + 46;
    if (nameStart + nameLength > bytes.length) throw new Error("The XLSX archive has an invalid file name.");
    const nextOffset = nameStart + nameLength + extraLength + commentLength;
    if (nextOffset > endRecord) throw new Error("The XLSX archive directory is truncated.");
    entries.set(decoder.decode(bytes.slice(nameStart, nameStart + nameLength)), { method, compressedSize, uncompressedSize, localOffset });
    directoryOffset = nextOffset;
  }

  const readEntry = async (name: string): Promise<Uint8Array | null> => {
    const entry = entries.get(name);
    if (!entry) return null;
    const offset = entry.localOffset;
    if (offset + 30 > bytes.length || view.getUint32(offset, true) !== 0x04034b50) {
      throw new Error("The XLSX archive contains a corrupt file entry.");
    }
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const start = offset + 30 + nameLength + extraLength;
    const end = start + entry.compressedSize;
    if (end > bytes.length) throw new Error("The XLSX archive contains a truncated file.");
    const compressed = bytes.slice(start, end);
    if (entry.method === 0) {
      if (compressed.byteLength !== entry.uncompressedSize) throw new Error("The XLSX archive contains an invalid stored file size.");
      return compressed;
    }
    if (entry.method !== 8 || typeof DecompressionStream === "undefined") {
      throw new Error("This browser cannot decompress this XLSX workbook. Use a current version of Chrome, Edge, or Firefox.");
    }
    try {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
      const expanded = new Uint8Array(await new Response(stream).arrayBuffer());
      if (expanded.byteLength !== entry.uncompressedSize) throw new Error("The XLSX archive contains an invalid decompressed file size.");
      return expanded;
    } catch {
      throw new Error("Could not decompress the XLSX workbook. The file may be damaged or encrypted.");
    }
  };

  const workbookBytes = await readEntry("xl/workbook.xml");
  const relationshipsBytes = await readEntry("xl/_rels/workbook.xml.rels");
  if (!workbookBytes || !relationshipsBytes) throw new Error("The XLSX workbook metadata is missing or corrupt.");
  const workbookXml = new DOMParser().parseFromString(decoder.decode(workbookBytes), "application/xml");
  const relationshipsXml = new DOMParser().parseFromString(decoder.decode(relationshipsBytes), "application/xml");
  if (workbookXml.querySelector("parsererror") || relationshipsXml.querySelector("parsererror")) {
    throw new Error("The XLSX workbook metadata is malformed.");
  }
  const firstSheet = workbookXml.getElementsByTagNameNS("*", "sheet")[0];
  const firstSheetRelId = firstSheet?.getAttribute("r:id") || firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  if (!firstSheetRelId) throw new Error("The first worksheet relationship is missing.");
  const relationship = Array.from(relationshipsXml.getElementsByTagNameNS("*", "Relationship"))
    .find((item) => item.getAttribute("Id") === firstSheetRelId);
  const target = relationship?.getAttribute("Target") || "";
  if (!target || relationship?.getAttribute("TargetMode") === "External") {
    throw new Error("The first worksheet relationship is invalid.");
  }
  const targetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const normalizedSegments: string[] = [];
  for (const segment of targetPath.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") normalizedSegments.pop();
    else normalizedSegments.push(segment);
  }
  const worksheetName = normalizedSegments.join("/");
  if (!/^xl\/worksheets\/[^/]+\.xml$/.test(worksheetName)) {
    throw new Error("The first worksheet target is outside the workbook worksheet directory.");
  }
  const sheetBytes = await readEntry(worksheetName);
  if (!sheetBytes) throw new Error("The first worksheet could not be read.");
  const sheetXml = new DOMParser().parseFromString(decoder.decode(sheetBytes), "application/xml");
  if (sheetXml.querySelector("parsererror")) throw new Error("The XLSX worksheet XML is malformed.");

  const sharedBytes = await readEntry("xl/sharedStrings.xml");
  const shared: string[] = [];
  if (sharedBytes) {
    const sharedXml = new DOMParser().parseFromString(decoder.decode(sharedBytes), "application/xml");
    if (sharedXml.querySelector("parsererror")) throw new Error("The XLSX shared-string table is malformed.");
    for (const item of Array.from(sharedXml.getElementsByTagNameNS("*", "si"))) {
      shared.push(Array.from(item.getElementsByTagNameNS("*", "t")).map((node) => node.textContent || "").join(""));
    }
  }

  const rowNodes = Array.from(sheetXml.getElementsByTagNameNS("*", "sheetData")[0]?.getElementsByTagNameNS("*", "row") || []);
  const result: string[][] = [];
  for (const rowNode of rowNodes) {
    const row: string[] = [];
    for (const cell of Array.from(rowNode.getElementsByTagNameNS("*", "c"))) {
      const reference = cell.getAttribute("r") || "";
      const letters = reference.match(/^[A-Z]+/i)?.[0] || "";
      let column = 0;
      for (const letter of letters.toUpperCase()) column = column * 26 + letter.charCodeAt(0) - 64;
      if (!column) continue;
      const type = cell.getAttribute("t");
      const valueNode = cell.getElementsByTagNameNS("*", "v")[0];
      let value = valueNode?.textContent || "";
      if (type === "s") {
        const stringIndex = Number(value);
        value = Number.isInteger(stringIndex) ? (shared[stringIndex] ?? "") : "";
      } else if (type === "inlineStr") {
        value = Array.from(cell.getElementsByTagNameNS("*", "t")).map((node) => node.textContent || "").join("");
      } else if (type === "b") {
        value = value === "1" ? "true" : "false";
      } else if (type === "e") {
        throw new Error("The XLSX worksheet contains an Excel error cell.");
      }
      row[column - 1] = value;
    }
    result.push(Array.from({ length: row.length }, (_, index) => row[index] ?? ""));
  }
  if (!result.length) throw new Error("The first worksheet is empty.");
  const headerIndexes = new Map(result[0].map((header, index) => [normalizeHeader(header), index]));
  for (const dateHeader of ["plant_date", "harvest_date"]) {
    const dateIndex = headerIndexes.get(dateHeader);
    if (dateIndex === undefined) continue;
    for (const row of result.slice(1)) {
      const serial = Number(row[dateIndex]);
      if (row[dateIndex] && Number.isFinite(serial) && serial >= 1 && serial <= 2958465) {
        const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
        row[dateIndex] = date.toISOString().slice(0, 10);
      }
    }
  }
  return result;
}

export function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map((value) => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }).join(",")).join("\n");
}
