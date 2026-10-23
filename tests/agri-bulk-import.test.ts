import { describe, expect, it } from "vitest";
import { parseCsvRows, parseXlsxRows, previewCsvImport, rowsToCsv, validateCropImport } from "../agri_farm/frontend/src/components/app/agriBulkImport";

describe("Agri CSV bulk import parsing", () => {
  it("parses quoted commas, escaped quotes, and line breaks inside quoted fields", () => {
    expect(parseCsvRows('name,notes\r\nWheat,"North, east"\r\nCorn,"He said ""grow""\nand harvest"')).toEqual([
      ["name", "notes"],
      ["Wheat", "North, east"],
      ["Corn", 'He said "grow"\nand harvest'],
    ]);
  });

  it("strips a UTF-8 BOM and normalizes header spelling", () => {
    expect(previewCsvImport('\uFEFFCrop Name,Plant Date\nWheat,2026-10-01', ["crop_name"]).headers).toEqual([
      "crop_name", "plant_date",
    ]);
  });

  it("rejects unclosed quotes, duplicate headers, and missing required columns", () => {
    expect(() => parseCsvRows('name,notes\nWheat,"unfinished')).toThrow(/unclosed quoted field/i);
    expect(() => previewCsvImport("name,Name\nWheat,Corn", ["name"])).toThrow(/duplicate column/i);
    expect(() => previewCsvImport("crop_name\nWheat", ["name"])).toThrow(/missing required column/i);
  });

  it("bounds input size and flags inconsistent row widths without dropping rows", () => {
    expect(() => previewCsvImport("name\nA\nB", ["name"], 1)).toThrow(/limited to 1 data rows/i);
    const preview = previewCsvImport("name,area_acres\nWheat,2\nCorn", ["name"]);
    expect(preview.rows).toHaveLength(2);
    expect(preview.errors).toEqual([{ row: 3, message: "This row has fewer values than the header row." }]);
  });

  it("validates crop-specific required fields and numeric/date inputs before import", () => {
    const preview = previewCsvImport("name,plant_date,area_acres\n,not-a-date,-1", ["name"]);
    expect(validateCropImport(preview).errors.map((error) => error.message)).toEqual([
      "Crop name is required.",
      "Plant date must be a valid date.",
      "Area must be a non-negative number.",
    ]);
  });

  it("preserves valid preview rows for explicit confirmation by the UI", () => {
    const preview = validateCropImport(previewCsvImport(
      "name,plant_date,area_acres\nWheat,2026-10-01,3.5",
      ["name"],
    ));
    expect(preview.errors).toEqual([]);
    expect(preview.rows).toEqual([{ name: "Wheat", plant_date: "2026-10-01", area_acres: "3.5" }]);
  });
  
  it("round-trips CSV-special characters and rejects oversized row counts", () => {
    const source = [["name", "notes"], ["Wheat", 'North, east says "grow"'], ["Corn", "line one\nline two"]];
    expect(parseCsvRows(rowsToCsv(source))).toEqual(source);
    const thousandRows = ["name", ...Array.from({ length: 1000 }, (_, i) => `Crop ${i}`)].join("\n");
    expect(() => previewCsvImport(thousandRows, ["name"], 999)).toThrow(/limited to 999 data rows/i);
  });

  it("rejects a non-ZIP workbook before attempting XML or decompression", async () => {
    await expect(parseXlsxRows(new TextEncoder().encode("not an xlsx file").buffer)).rejects.toThrow(/not a valid XLSX/i);
  });

  it("keeps import validation strict for formula-like and unexpected columns", () => {
    const preview = validateCropImport(previewCsvImport(
      "name,plant_date,area_kanal\nWheat,2026-10-23,4",
      ["name"],
    ));
    expect(preview.errors).toEqual([]);
    const malformed = previewCsvImport("name,area_kanal\nWheat,4,extra", ["name"]);
    expect(malformed.errors).toEqual([{ row: 2, message: "This row has more values than the header row." }]);
  });

});
