import { describe, expect, it } from "vitest";
import { parseCsvRows, previewCsvImport, validateCropImport } from "../agri_farm/frontend/src/components/app/agriBulkImport";

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
});
