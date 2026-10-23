import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("Agri task and finance bulk-import API contracts", () => {
  it("validates task rows and enforces the 200-row limit before insertMany", () => {
    const source = read("agri_farm/backend/routes/tasks.js");
    const bulk = source.slice(source.indexOf("router.post('/tasks/bulk'"), source.indexOf("// Keep only valid, existing laborer ids"));
    expect(bulk).toContain("rows.length > 200");
    expect(bulk).toContain("if (errors.length) return res.status(400)");
    expect(bulk.indexOf("if (errors.length) return res.status(400)")).toBeLessThan(bulk.indexOf("Task.insertMany(prepared)"));
    expect(bulk).toContain("status: 'Pending'");
    expect(bulk).toContain("cleanLaborerIds");
    expect(bulk).toContain("Crop must exist in the selected farm.");
    expect(bulk).toContain("Inventory item must exist in the selected farm.");
  });

  it("validates finance rows and restricts imported fields before insertMany", () => {
    const source = read("agri_farm/backend/routes/finance.js");
    const bulk = source.slice(source.indexOf("router.post('/finance/bulk'"), source.indexOf("router.post('/finance'"));
    expect(bulk).toContain("rows.length > 200");
    expect(bulk).toContain("if (errors.length) return res.status(400)");
    expect(bulk.indexOf("if (errors.length) return res.status(400)")).toBeLessThan(bulk.indexOf("Finance.insertMany(prepared)"));
    expect(bulk).toContain("type !== 'income' && type !== 'expense'");
    expect(bulk).toContain("category, type, amount, date");
    expect(bulk).not.toContain("...row");
    expect(bulk).toContain("Crop must exist in the selected farm.");
  });

  it("extends the HTTP farm-scope checker to cover validation and cross-farm import isolation", () => {
    const checker = read("tools/check-farm-scope.js");
    expect(checker).toContain("'/api/tasks/bulk'");
    expect(checker).toContain("'/api/finance/bulk'");
    expect(checker).toContain("bulk task row is hidden from farm A");
    expect(checker).toContain("bulk finance row is hidden from farm A");
  });

  it("wires preview-first CSV/XLSX imports to both bulk endpoints", () => {
    const ui = read("agri_farm/frontend/src/components/AgriBulkCsvImport.tsx");
    const api = read("agri_farm/frontend/src/api.ts");
    const app = read("agri_farm/frontend/src/App.tsx");
    expect(ui).toContain("previewCsvImport");
    expect(ui).toContain("parseXlsxRows");
    expect(ui).toContain("1000");
    expect(ui).toContain("setPreview({ ...parsed, errors }");
    expect(api).toContain("api.post('/tasks/bulk', { rows })");
    expect(api).toContain("api.post('/finance/bulk', { rows })");
    expect(app).toContain("api.addTasksBulk(chunk)");
    expect(app).toContain("api.addFinanceBulk(chunk)");
  });
});
