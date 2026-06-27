import { describe, it, expect } from "vitest";
import {
  serializeRules,
  planImport,
  RULES_FILE_VERSION,
  type SerializableRule,
  type SerializableCategory,
  type RulesExportFile,
  type ImportExistingState,
} from "../rules-io";

const at = new Date("2026-06-27T12:00:00.000Z");

const cat = (id: number, name: string, emoji: string): SerializableCategory => ({
  id,
  name,
  emoji,
});
const rule = (id: number, match: string, categoryId: number): SerializableRule => ({
  id,
  match,
  categoryId,
});

describe("serializeRules", () => {
  it("produces the versioned shape with an exportedAt timestamp", () => {
    const file = serializeRules([], [], at);
    expect(file.version).toBe(RULES_FILE_VERSION);
    expect(file.version).toBe(1);
    expect(file.exportedAt).toBe("2026-06-27T12:00:00.000Z");
    expect(Array.isArray(file.rules)).toBe(true);
  });

  it("references each rule's category by name and emoji (not numeric id)", () => {
    const categories = [cat(10, "Supermercado", "🛒"), cat(20, "Transporte", "🚌")];
    const rules = [rule(1, "Jumbo", 10), rule(2, "Uber", 20)];

    const file = serializeRules(rules, categories, at);

    expect(file.rules).toEqual([
      { match: "Jumbo", category: { name: "Supermercado", emoji: "🛒" } },
      { match: "Uber", category: { name: "Transporte", emoji: "🚌" } },
    ]);
  });

  it("produces a valid file with an empty rules array when there are no rules", () => {
    const file = serializeRules([], [cat(10, "Supermercado", "🛒")], at);
    expect(file.rules).toEqual([]);
    expect(file.version).toBe(1);
  });
});

// Helpers for planImport: build a valid file string + an existing-state snapshot.
const fileWith = (
  rules: RulesExportFile["rules"]
): string =>
  JSON.stringify({ version: RULES_FILE_VERSION, exportedAt: at.toISOString(), rules });

const existing = (
  categories: { id: number; name: string }[],
  rules: { match: string }[] = []
): ImportExistingState => ({ categories, rules });

// Narrows the ImportPlan union to its accepted (ok: true) branch, failing the
// test with a clear message if the plan was unexpectedly rejected.
const accepted = (plan: ReturnType<typeof planImport>) => {
  if (!plan.ok) throw new Error(`expected accepted plan, got error: ${plan.error}`);
  return plan;
};

describe("planImport", () => {
  it("plans new rules and references each category by name + emoji", () => {
    const contents = fileWith([
      { match: "Jumbo", category: { name: "Supermercado", emoji: "🛒" } },
      { match: "Uber", category: { name: "Transporte", emoji: "🚌" } },
    ]);
    const plan = accepted(
      planImport(
        contents,
        existing([
          { id: 10, name: "Supermercado" },
          { id: 20, name: "Transporte" },
        ])
      )
    );

    expect(plan.toCreate).toEqual([
      { match: "Jumbo", category: { name: "Supermercado", emoji: "🛒" } },
      { match: "Uber", category: { name: "Transporte", emoji: "🚌" } },
    ]);
    expect(plan.report.created).toEqual(["Jumbo", "Uber"]);
    expect(plan.report.createdCategories).toEqual([]);
    expect(plan.report.skippedExisting).toEqual([]);
  });

  it("trims match text before planning a new rule", () => {
    const contents = fileWith([
      { match: "  Jumbo  ", category: { name: "Supermercado", emoji: "🛒" } },
    ]);
    const plan = accepted(
      planImport(contents, existing([{ id: 10, name: "Supermercado" }]))
    );

    expect(plan.toCreate).toEqual([
      { match: "Jumbo", category: { name: "Supermercado", emoji: "🛒" } },
    ]);
  });

  it("skips a match that already exists locally (case-insensitive, after trim)", () => {
    const contents = fileWith([
      { match: " jumbo ", category: { name: "Supermercado", emoji: "🛒" } },
      { match: "Lider", category: { name: "Supermercado", emoji: "🛒" } },
    ]);
    const plan = accepted(
      planImport(
        contents,
        existing([{ id: 10, name: "Supermercado" }], [{ match: "JUMBO" }])
      )
    );

    expect(plan.toCreate).toEqual([
      { match: "Lider", category: { name: "Supermercado", emoji: "🛒" } },
    ]);
    expect(plan.report.created).toEqual(["Lider"]);
    expect(plan.report.skippedExisting).toEqual(["jumbo"]);
  });

  it("treats a valid file with an empty rules array as a no-op", () => {
    const plan = accepted(
      planImport(fileWith([]), existing([{ id: 10, name: "Supermercado" }]))
    );
    expect(plan.toCreate).toEqual([]);
    expect(plan.report.created).toEqual([]);
    expect(plan.report.skippedExisting).toEqual([]);
  });

  it("treats an empty (whitespace) file as a harmless no-op", () => {
    const plan = accepted(
      planImport("   ", existing([{ id: 10, name: "Supermercado" }]))
    );
    expect(plan.toCreate).toEqual([]);
    expect(plan.report.created).toEqual([]);
    expect(plan.report.skippedExisting).toEqual([]);
  });

  // ─── Auto-create missing categories ───

  it("queues a missing category for auto-create using the file's emoji", () => {
    const contents = fileWith([
      { match: "Netflix", category: { name: "Streaming", emoji: "🎬" } },
    ]);
    const plan = accepted(planImport(contents, existing([])));

    expect(plan.toCreate).toEqual([
      { match: "Netflix", category: { name: "Streaming", emoji: "🎬" } },
    ]);
    expect(plan.report.createdCategories).toEqual(["Streaming"]);
  });

  it("falls back to the default emoji when the file's emoji is missing/blank", () => {
    const contents = fileWith([
      { match: "Netflix", category: { name: "Streaming", emoji: "  " } },
    ]);
    const plan = accepted(planImport(contents, existing([])));

    expect(plan.toCreate).toEqual([
      { match: "Netflix", category: { name: "Streaming", emoji: "📌" } },
    ]);
  });

  it("reuses an existing category by name and never reports it as created", () => {
    const contents = fileWith([
      { match: "Jumbo", category: { name: "Supermercado", emoji: "🍅" } },
    ]);
    const plan = accepted(
      planImport(contents, existing([{ id: 10, name: "Supermercado" }]))
    );

    expect(plan.report.created).toEqual(["Jumbo"]);
    expect(plan.report.createdCategories).toEqual([]);
  });

  it("lists each auto-created category once even when several rules share it", () => {
    const contents = fileWith([
      { match: "Netflix", category: { name: "Streaming", emoji: "🎬" } },
      { match: "Spotify", category: { name: "Streaming", emoji: "🎬" } },
    ]);
    const plan = accepted(planImport(contents, existing([])));

    expect(plan.toCreate).toHaveLength(2);
    expect(plan.report.createdCategories).toEqual(["Streaming"]);
  });

  // ─── Structural rejection (reject-all) ───

  it("rejects invalid JSON without planning anything", () => {
    const plan = planImport("{ not json", existing([]));
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toMatch(/JSON/i);
  });

  it("rejects an unknown version", () => {
    const contents = JSON.stringify({ version: 99, exportedAt: at.toISOString(), rules: [] });
    const plan = planImport(contents, existing([]));
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toMatch(/[Vv]ersión/);
  });

  it("rejects a wrong top-level shape (rules not an array)", () => {
    const contents = JSON.stringify({ version: 1, exportedAt: at.toISOString(), rules: {} });
    const plan = planImport(contents, existing([]));
    expect(plan.ok).toBe(false);
  });

  it("rejects a non-object top level (e.g. a JSON array)", () => {
    const plan = planImport("[]", existing([]));
    expect(plan.ok).toBe(false);
  });

  // ─── Per-rule invalid skipping (skip half) ───

  it("skips invalid rules (empty match / missing category) but imports valid siblings", () => {
    const contents = fileWith([
      { match: "  ", category: { name: "Supermercado", emoji: "🛒" } },
      { match: "Uber", category: { name: "", emoji: "🚌" } },
      { match: "Jumbo", category: { name: "Supermercado", emoji: "🛒" } },
    ]);
    const plan = accepted(
      planImport(contents, existing([{ id: 10, name: "Supermercado" }]))
    );

    expect(plan.report.created).toEqual(["Jumbo"]);
    expect(plan.report.skippedInvalid).toEqual(["", "Uber"]);
  });

  // ─── Within-file dedup ───

  it("keeps the first of two same-normalized matches and skips the rest as duplicate", () => {
    const contents = fileWith([
      { match: "Jumbo", category: { name: "Supermercado", emoji: "🛒" } },
      { match: " jumbo ", category: { name: "Supermercado", emoji: "🛒" } },
    ]);
    const plan = accepted(
      planImport(contents, existing([{ id: 10, name: "Supermercado" }]))
    );

    expect(plan.report.created).toEqual(["Jumbo"]);
    expect(plan.report.skippedDuplicate).toEqual(["jumbo"]);
  });

  it("classifies a duplicate-of-existing as already-exists, not duplicate-in-file", () => {
    const contents = fileWith([
      { match: "Jumbo", category: { name: "Supermercado", emoji: "🛒" } },
      { match: "jumbo", category: { name: "Supermercado", emoji: "🛒" } },
    ]);
    const plan = accepted(
      planImport(
        contents,
        existing([{ id: 10, name: "Supermercado" }], [{ match: "JUMBO" }])
      )
    );

    expect(plan.report.created).toEqual([]);
    expect(plan.report.skippedExisting).toEqual(["Jumbo", "jumbo"]);
    expect(plan.report.skippedDuplicate).toEqual([]);
  });
});
