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
      update: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      updateMany: vi.fn(),
    },
    rule: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { updateCategory, deleteCategory } from "../actions";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

const mockPrisma = prisma as unknown as {
  category: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  transaction: {
    updateMany: ReturnType<typeof vi.fn>;
  };
  rule: {
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
