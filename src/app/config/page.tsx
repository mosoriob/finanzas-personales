import { prisma } from "@/lib/db";
import { ConfigClient } from "./ConfigClient";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const [accounts, categories, rules, pending] = await Promise.all([
    prisma.account.findMany({
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    }),
    prisma.rule.findMany({
      orderBy: { match: "asc" },
      include: { category: true },
    }),
    prisma.pendingSyncTransaction.findMany({
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const ruleViews = rules.map((r) => ({
    id: r.id,
    match: r.match,
    categoryId: r.categoryId,
    category: { id: r.category.id, name: r.category.name, emoji: r.category.emoji },
  }));

  // Build the review-panel props: each suspect side-by-side with the existing
  // transaction it might duplicate. `candidateId` is a loose (non-FK) reference,
  // so the candidate is fetched separately and may be missing (deleted since it
  // was queued) — in which case the suspect is still shown and acceptable.
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const candidateIds = [...new Set(pending.map((p) => p.candidateId))];
  const candidates = candidateIds.length
    ? await prisma.transaction.findMany({
        where: { id: { in: candidateIds } },
        include: { account: true, category: true },
      })
    : [];
  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  const pendingSuspects = pending.map((p) => {
    const account = accountById.get(p.accountId);
    const category = categoryById.get(p.categoryId);
    const cand = candidateById.get(p.candidateId);
    return {
      id: p.id,
      date: p.date.toISOString(),
      description: p.description,
      amount: p.amount,
      currency: p.currency,
      account: { id: p.accountId, name: account?.name ?? "Cuenta" },
      category: {
        id: p.categoryId,
        name: category?.name ?? "Otro",
        emoji: category?.emoji ?? "📌",
      },
      candidate: cand
        ? {
            id: cand.id,
            date: cand.date.toISOString(),
            description: cand.description,
            amount: cand.amount,
            currency: cand.currency,
            account: { id: cand.account.id, name: cand.account.name },
            category: {
              id: cand.category.id,
              name: cand.category.name,
              emoji: cand.category.emoji,
            },
          }
        : null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Configuración</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Administra tus cuentas, categorías y reglas
        </p>
      </div>
      <ConfigClient
        accounts={accounts}
        categories={categories}
        rules={ruleViews}
        pendingSuspects={pendingSuspects}
      />
    </div>
  );
}
