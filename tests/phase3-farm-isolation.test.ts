import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error Shared backend helper is JavaScript without declarations.
import { mufResolveFarmAccess, mufScopeFilter } from "../agri_farm/backend/muf-farms.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("Phase 3 farm isolation regression contracts", () => {
  it("forces single-farm filters to the selected farm even when the client supplies another farmId", () => {
    const ctx = { mode: "single", farmId: "farm-A", farmIds: ["farm-A"] };
    expect(mufScopeFilter({ status: "Growing" }, ctx)).toEqual({ status: "Growing", farmId: "farm-A" });
    expect(mufScopeFilter({ farmId: "farm-B", status: "Growing" }, ctx)).toEqual({
      $and: [{ farmId: "farm-B", status: "Growing" }, { farmId: "farm-A" }],
    });
  });

  it("limits all-farms reads to the user's allowed active farm IDs", () => {
    const access = mufResolveFarmAccess({
      user: { _id: "worker-1", role: "manager", farmIds: ["farm-A", "farm-B"] },
      farms: [
        { _id: "farm-A", archived: false },
        { _id: "farm-B", archived: false },
        { _id: "farm-C", archived: false },
        { _id: "farm-D", archived: true },
      ],
      requested: "all",
    });
    expect(access.ok).toBe(true);
    if (access.ok) expect(access.ctx).toMatchObject({ mode: "all", farmIds: ["farm-A", "farm-B"] });
  });

  it("keeps Agri paged read and count operations inside farm-scoped model wrappers", () => {
    const source = readFileSync(path.join(repoRoot, "agri_farm/backend/muf-farms.mjs"), "utf8");
    const crops = readFileSync(path.join(repoRoot, "agri_farm/backend/routes/crops.js"), "utf8");
    const tasks = readFileSync(path.join(repoRoot, "agri_farm/backend/routes/tasks.js"), "utf8");
    const finance = readFileSync(path.join(repoRoot, "agri_farm/backend/routes/finance.js"), "utf8");
    expect(source).toContain("'countDocuments'");
    expect(source).toContain("mufScopeFilter");
    for (const route of [crops, tasks, finance]) {
      expect(route).toContain("countDocuments(");
      expect(route).toContain("res.set('X-Total-Count'");
      expect(route).toContain(".sort({");
    }
    expect(finance).toContain("protect, requireAdmin");
  });

  it("keeps the memory-mode HTTP farm-isolation checker covering Agri record create/read/update/delete", () => {
    const checker = readFileSync(path.join(repoRoot, "tools/check-farm-scope.js"), "utf8");
    expect(checker).toContain("agri_farm/backend");
    expect(checker).toContain("list: '/api/crops'");
    expect(checker).toContain("create: (tag) => ({ path: '/api/crops'");
    expect(checker).toContain("update: (id) => ({ path: `/api/crops/${id}`");
    expect(checker).toContain("remove: (id) => `/api/crops/${id}`");
  });
});
