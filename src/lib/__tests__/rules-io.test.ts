import { describe, it, expect } from "vitest";
import {
  serializeRules,
  RULES_FILE_VERSION,
  type SerializableRule,
  type SerializableCategory,
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
