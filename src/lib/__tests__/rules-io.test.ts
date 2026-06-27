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

describe("planImport", () => {
  it("plans new rules and resolves each category by existing name", () => {
    const contents = fileWith([
      { match: "Jumbo", category: { name: "Supermercado", emoji: "🛒" } },
      { match: "Uber", category: { name: "Transporte", emoji: "🚌" } },
    ]);
    const plan = planImport(
      contents,
      existing([
        { id: 10, name: "Supermercado" },
        { id: 20, name: "Transporte" },
      ])
    );

    expect(plan.toCreate).toEqual([
      { match: "Jumbo", categoryId: 10 },
      { match: "Uber", categoryId: 20 },
    ]);
    expect(plan.report.created).toEqual(["Jumbo", "Uber"]);
    expect(plan.report.skippedExisting).toEqual([]);
  });

  it("trims match text before planning a new rule", () => {
    const contents = fileWith([
      { match: "  Jumbo  ", category: { name: "Supermercado", emoji: "🛒" } },
    ]);
    const plan = planImport(contents, existing([{ id: 10, name: "Supermercado" }]));

    expect(plan.toCreate).toEqual([{ match: "Jumbo", categoryId: 10 }]);
  });

  it("skips a match that already exists locally (case-insensitive, after trim)", () => {
    const contents = fileWith([
      { match: " jumbo ", category: { name: "Supermercado", emoji: "🛒" } },
      { match: "Lider", category: { name: "Supermercado", emoji: "🛒" } },
    ]);
    const plan = planImport(
      contents,
      existing([{ id: 10, name: "Supermercado" }], [{ match: "JUMBO" }])
    );

    expect(plan.toCreate).toEqual([{ match: "Lider", categoryId: 10 }]);
    expect(plan.report.created).toEqual(["Lider"]);
    expect(plan.report.skippedExisting).toEqual(["jumbo"]);
  });

  it("treats a valid file with an empty rules array as a no-op", () => {
    const plan = planImport(fileWith([]), existing([{ id: 10, name: "Supermercado" }]));
    expect(plan.toCreate).toEqual([]);
    expect(plan.report.created).toEqual([]);
    expect(plan.report.skippedExisting).toEqual([]);
  });

  it("treats an empty (whitespace) file as a harmless no-op", () => {
    const plan = planImport("   ", existing([{ id: 10, name: "Supermercado" }]));
    expect(plan.toCreate).toEqual([]);
    expect(plan.report.created).toEqual([]);
    expect(plan.report.skippedExisting).toEqual([]);
  });
});
