import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache before importing actions
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock prisma db
vi.mock("@/lib/db", () => ({
  prisma: {
    category: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    rule: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import {
  updateCategory,
  deleteCategory,
  createRule,
  updateRule,
  deleteRule,
  previewApplyRules,
  applyRulesToExisting,
  exportRules,
  importRules,
} from "../actions";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

const mockPrisma = prisma as unknown as {
  category: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  transaction: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  rule: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── updateCategory ───

describe("updateCategory", () => {
  it("returns error when name is empty", async () => {
    const result = await updateCategory(1, { name: "  ", emoji: "🛒" });
    expect(result).toEqual({ ok: false, error: "El nombre no puede estar vacío" });
    expect(mockPrisma.category.findFirst).not.toHaveBeenCalled();
  });

  it("returns error when name already exists (different category)", async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: 2, name: "Supermercado" });
    const result = await updateCategory(1, { name: "Supermercado", emoji: "🛒" });
    expect(result).toEqual({ ok: false, error: "Ya existe una categoría con ese nombre" });
    expect(mockPrisma.category.update).not.toHaveBeenCalled();
  });

  it("updates category successfully with trimmed name", async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null);
    mockPrisma.category.update.mockResolvedValue({ id: 1, name: "Supermercado", emoji: "🛒" });

    const result = await updateCategory(1, { name: "  Supermercado  ", emoji: "🛒" });
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.category.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "Supermercado", emoji: "🛒" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/config");
    expect(revalidatePath).toHaveBeenCalledWith("/transacciones");
  });

  it("uses default emoji when emoji is empty", async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null);
    mockPrisma.category.update.mockResolvedValue({ id: 1, name: "Supermercado", emoji: "📌" });

    const result = await updateCategory(1, { name: "Supermercado", emoji: "" });
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.category.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "Supermercado", emoji: "📌" },
    });
  });

  it("allows renaming to its own current name (unique check excludes self)", async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null); // no OTHER category with same name
    mockPrisma.category.update.mockResolvedValue({ id: 1, name: "Supermercado", emoji: "🛒" });

    const result = await updateCategory(1, { name: "Supermercado", emoji: "🛒" });
    expect(result).toEqual({ ok: true });
    // findFirst called with NOT: { id: 1 } to exclude self
    expect(mockPrisma.category.findFirst).toHaveBeenCalledWith({
      where: { name: "Supermercado", NOT: { id: 1 } },
    });
  });
});

// ─── deleteCategory ───

describe("deleteCategory", () => {
  it("returns error when deleting into itself", async () => {
    const result = await deleteCategory(1, 1);
    expect(result).toEqual({ ok: false, error: "La categoría de reemplazo no puede ser la misma" });
    expect(mockPrisma.category.findUnique).not.toHaveBeenCalled();
  });

  it("returns error when target category not found", async () => {
    mockPrisma.category.findUnique.mockResolvedValueOnce(null); // target
    mockPrisma.category.findUnique.mockResolvedValueOnce({ id: 2, name: "Otro" }); // replacement

    const result = await deleteCategory(1, 2);
    expect(result).toEqual({ ok: false, error: "Categoría no encontrada" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns error when replacement category not found", async () => {
    mockPrisma.category.findUnique.mockResolvedValueOnce({ id: 1, name: "Supermercado" }); // target
    mockPrisma.category.findUnique.mockResolvedValueOnce(null); // replacement not found

    const result = await deleteCategory(1, 2);
    expect(result).toEqual({ ok: false, error: "Categoría de reemplazo no encontrada" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("reassigns transactions and deletes category in a transaction", async () => {
    mockPrisma.category.findUnique.mockResolvedValueOnce({ id: 1, name: "Supermercado" });
    mockPrisma.category.findUnique.mockResolvedValueOnce({ id: 2, name: "Otro" });
    mockPrisma.$transaction.mockResolvedValue([]);

    const result = await deleteCategory(1, 2);
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/config");
    expect(revalidatePath).toHaveBeenCalledWith("/transacciones");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("repoints rules to the replacement category in the same transaction", async () => {
    mockPrisma.category.findUnique.mockResolvedValueOnce({ id: 1, name: "Supermercado" });
    mockPrisma.category.findUnique.mockResolvedValueOnce({ id: 2, name: "Otro" });
    mockPrisma.$transaction.mockResolvedValue([]);

    const result = await deleteCategory(1, 2);
    expect(result).toEqual({ ok: true });

    // The three writes (transactions, rules, delete) must be passed together to $transaction.
    expect(mockPrisma.rule.updateMany).toHaveBeenCalledWith({
      where: { categoryId: 1 },
      data: { categoryId: 2 },
    });
    expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { categoryId: 1 },
      data: { categoryId: 2 },
    });
    const batch = mockPrisma.$transaction.mock.calls[0][0];
    expect(batch).toHaveLength(3);
  });

  it("revalidates all needed paths on success", async () => {
    mockPrisma.category.findUnique.mockResolvedValueOnce({ id: 1, name: "Supermercado" });
    mockPrisma.category.findUnique.mockResolvedValueOnce({ id: 2, name: "Otro" });
    mockPrisma.$transaction.mockResolvedValue([]);

    await deleteCategory(1, 2);
    expect(revalidatePath).toHaveBeenCalledWith("/config");
    expect(revalidatePath).toHaveBeenCalledWith("/transacciones");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});

// ─── createRule ───

describe("createRule", () => {
  it("rejects empty / whitespace-only match text", async () => {
    const result = await createRule({ match: "   ", categoryId: 1 });
    expect(result).toEqual({
      ok: false,
      error: "El texto a buscar no puede estar vacío",
    });
    expect(mockPrisma.rule.create).not.toHaveBeenCalled();
  });

  it("rejects when the category does not exist", async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);
    const result = await createRule({ match: "Jumbo", categoryId: 99 });
    expect(result).toEqual({ ok: false, error: "Categoría no encontrada" });
    expect(mockPrisma.rule.create).not.toHaveBeenCalled();
  });

  it("rejects a case-insensitive duplicate match", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1, name: "Supermercado" });
    mockPrisma.rule.findMany.mockResolvedValue([{ id: 5, match: "JUMBO", categoryId: 1 }]);
    const result = await createRule({ match: "jumbo", categoryId: 1 });
    expect(result).toEqual({ ok: false, error: "Ya existe una regla con ese texto" });
    expect(mockPrisma.rule.create).not.toHaveBeenCalled();
  });

  it("creates a rule with trimmed match text", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1, name: "Supermercado" });
    mockPrisma.rule.findMany.mockResolvedValue([]);
    mockPrisma.rule.create.mockResolvedValue({ id: 1, match: "Jumbo", categoryId: 1 });

    const result = await createRule({ match: "  Jumbo  ", categoryId: 1 });
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.rule.create).toHaveBeenCalledWith({
      data: { match: "Jumbo", categoryId: 1 },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/config");
  });
});

// ─── updateRule ───

describe("updateRule", () => {
  it("rejects empty / whitespace-only match text", async () => {
    const result = await updateRule(1, { match: "  ", categoryId: 1 });
    expect(result).toEqual({
      ok: false,
      error: "El texto a buscar no puede estar vacío",
    });
    expect(mockPrisma.rule.update).not.toHaveBeenCalled();
  });

  it("rejects a case-insensitive duplicate from a different rule", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1, name: "Supermercado" });
    mockPrisma.rule.findMany.mockResolvedValue([
      { id: 1, match: "Lider", categoryId: 1 },
      { id: 2, match: "JUMBO", categoryId: 1 },
    ]);
    const result = await updateRule(1, { match: "jumbo", categoryId: 1 });
    expect(result).toEqual({ ok: false, error: "Ya existe una regla con ese texto" });
    expect(mockPrisma.rule.update).not.toHaveBeenCalled();
  });

  it("allows keeping its own match text (uniqueness excludes self)", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1, name: "Supermercado" });
    mockPrisma.rule.findMany.mockResolvedValue([{ id: 1, match: "Jumbo", categoryId: 1 }]);
    mockPrisma.rule.update.mockResolvedValue({ id: 1, match: "Jumbo", categoryId: 2 });

    const result = await updateRule(1, { match: "Jumbo", categoryId: 2 });
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.rule.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { match: "Jumbo", categoryId: 2 },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/config");
  });
});

// ─── deleteRule ───

describe("deleteRule", () => {
  it("deletes the rule and revalidates", async () => {
    mockPrisma.rule.delete.mockResolvedValue({ id: 1 });
    await deleteRule(1);
    expect(mockPrisma.rule.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(revalidatePath).toHaveBeenCalledWith("/config");
  });
});

// ─── exportRules ───

describe("exportRules", () => {
  it("returns the serialized JSON from loaded rules/categories (category by name+emoji)", async () => {
    mockPrisma.rule.findMany.mockResolvedValue([
      { id: 1, match: "Jumbo", categoryId: 10 },
      { id: 2, match: "Uber", categoryId: 20 },
    ]);
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 10, name: "Supermercado", emoji: "🛒" },
      { id: 20, name: "Transporte", emoji: "🚌" },
    ]);

    const json = await exportRules();
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(1);
    expect(typeof parsed.exportedAt).toBe("string");
    expect(parsed.rules).toEqual([
      { match: "Jumbo", category: { name: "Supermercado", emoji: "🛒" } },
      { match: "Uber", category: { name: "Transporte", emoji: "🚌" } },
    ]);
  });

  it("returns a valid file with an empty rules array when there are no rules", async () => {
    mockPrisma.rule.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const json = await exportRules();
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(1);
    expect(parsed.rules).toEqual([]);
  });
});

// ─── importRules ───

const importFile = (rules: unknown[]) =>
  JSON.stringify({ version: 1, exportedAt: "2026-06-27T12:00:00.000Z", rules });

describe("importRules", () => {
  it("inserts the planned rules in a single $transaction and returns the report", async () => {
    mockPrisma.rule.findMany.mockResolvedValue([]); // no existing rules
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 10, name: "Supermercado", emoji: "🛒" },
      { id: 20, name: "Transporte", emoji: "🚌" },
    ]);
    mockPrisma.rule.create.mockImplementation((args: unknown) => args);
    mockPrisma.$transaction.mockResolvedValue([]);

    const result = await importRules(
      importFile([
        { match: "Jumbo", category: { name: "Supermercado", emoji: "🛒" } },
        { match: "Uber", category: { name: "Transporte", emoji: "🚌" } },
      ])
    );

    expect(result).toEqual({
      ok: true,
      created: ["Jumbo", "Uber"],
      skippedExisting: [],
    });
    expect(mockPrisma.rule.create).toHaveBeenCalledWith({
      data: { match: "Jumbo", categoryId: 10 },
    });
    expect(mockPrisma.rule.create).toHaveBeenCalledWith({
      data: { match: "Uber", categoryId: 20 },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const batch = mockPrisma.$transaction.mock.calls[0][0];
    expect(batch).toHaveLength(2);
    expect(revalidatePath).toHaveBeenCalledWith("/config");
  });

  it("skips a match that already exists locally and reports it without writing it", async () => {
    mockPrisma.rule.findMany.mockResolvedValue([{ id: 1, match: "JUMBO", categoryId: 10 }]);
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 10, name: "Supermercado", emoji: "🛒" },
    ]);
    mockPrisma.rule.create.mockImplementation((args: unknown) => args);
    mockPrisma.$transaction.mockResolvedValue([]);

    const result = await importRules(
      importFile([
        { match: " jumbo ", category: { name: "Supermercado", emoji: "🛒" } },
        { match: "Lider", category: { name: "Supermercado", emoji: "🛒" } },
      ])
    );

    expect(result).toEqual({
      ok: true,
      created: ["Lider"],
      skippedExisting: ["jumbo"],
    });
    const batch = mockPrisma.$transaction.mock.calls[0][0];
    expect(batch).toHaveLength(1);
  });

  it("treats an empty file as a no-op (0 created, no writes)", async () => {
    mockPrisma.rule.findMany.mockResolvedValue([]);
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await importRules("");

    expect(result).toEqual({ ok: true, created: [], skippedExisting: [] });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.rule.create).not.toHaveBeenCalled();
  });
});

// ─── previewApplyRules ───

describe("previewApplyRules", () => {
  it("errors when the \"Otro\" category does not exist", async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null);
    const result = await previewApplyRules();
    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it("counts only \"Otro\" transactions whose description now matches a rule", async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: 99, name: "Otro" });
    mockPrisma.transaction.findMany.mockResolvedValue([
      { id: 1, description: "COMPRA JUMBO MAIPU" },
      { id: 2, description: "PAGO DESCONOCIDO" },
      { id: 3, description: "MERPAGO*UBER TRIP" },
    ]);
    mockPrisma.rule.findMany.mockResolvedValue([
      { id: 10, match: "JUMBO", categoryId: 1 },
      { id: 11, match: "UBER", categoryId: 2 },
    ]);

    const result = await previewApplyRules();
    expect(result).toEqual({ ok: true, count: 2 });
  });

  it("does not count a transaction whose matching rule points back at \"Otro\"", async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: 99, name: "Otro" });
    mockPrisma.transaction.findMany.mockResolvedValue([
      { id: 1, description: "COMPRA JUMBO MAIPU" },
    ]);
    mockPrisma.rule.findMany.mockResolvedValue([
      { id: 10, match: "JUMBO", categoryId: 99 },
    ]);

    const result = await previewApplyRules();
    expect(result).toEqual({ ok: true, count: 0 });
  });

  it("only considers transactions currently in \"Otro\" (manual categories untouched)", async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: 99, name: "Otro" });
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    mockPrisma.rule.findMany.mockResolvedValue([]);

    await previewApplyRules();

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { categoryId: 99 } })
    );
  });
});

// ─── applyRulesToExisting ───

describe("applyRulesToExisting", () => {
  it("updates matching transactions grouped by category and reports the count", async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: 99, name: "Otro" });
    mockPrisma.transaction.findMany.mockResolvedValue([
      { id: 1, description: "COMPRA JUMBO MAIPU" },
      { id: 2, description: "OTRO JUMBO" },
      { id: 3, description: "MERPAGO*UBER TRIP" },
      { id: 4, description: "NADA QUE VER" },
    ]);
    mockPrisma.rule.findMany.mockResolvedValue([
      { id: 10, match: "JUMBO", categoryId: 1 },
      { id: 11, match: "UBER", categoryId: 2 },
    ]);
    mockPrisma.$transaction.mockResolvedValue([]);

    const result = await applyRulesToExisting();
    expect(result).toEqual({ ok: true, updated: 3 });

    // One updateMany per target category (JUMBO→1 for ids 1,2; UBER→2 for id 3).
    expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      data: { categoryId: 1 },
    });
    expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [3] } },
      data: { categoryId: 2 },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/transacciones");
  });

  it("reports 0 and skips the batch when nothing matches", async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: 99, name: "Otro" });
    mockPrisma.transaction.findMany.mockResolvedValue([
      { id: 1, description: "NADA QUE VER" },
    ]);
    mockPrisma.rule.findMany.mockResolvedValue([
      { id: 10, match: "JUMBO", categoryId: 1 },
    ]);

    const result = await applyRulesToExisting();
    expect(result).toEqual({ ok: true, updated: 0 });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
