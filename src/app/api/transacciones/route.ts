import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseMesParam,
  getDateFilterForMonth,
  parsePageParam,
} from "@/lib/month-utils";
import { isFamiliar } from "@/lib/familiar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mesParam = searchParams.get("mes") ?? undefined;
  const paginaParam = searchParams.get("pagina") ?? undefined;

  const pagina = parsePageParam(paginaParam);
  const dateInfo = parseMesParam(mesParam);
  const dateFilter = getDateFilterForMonth(dateInfo);

  const whereFilter = {
    account: { hidden: false },
    ...(dateFilter ? { date: dateFilter } : {}),
  };

  try {
    const transactions = await prisma.transaction.findMany({
      where: whereFilter,
      include: {
        account: true,
        category: true,
      },
      orderBy: { date: "desc" },
      skip: (pagina - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    const serialized = transactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      description: t.description,
      note: t.note,
      amount: t.amount,
      familiar: isFamiliar(t.familiar) ? t.familiar : null,
      isReimbursed: t.isReimbursed,
      account: { id: t.account.id, name: t.account.name },
      category: {
        id: t.category.id,
        name: t.category.name,
        emoji: t.category.emoji,
      },
    }));

    return NextResponse.json({ transactions: serialized });
  } catch (err) {
    console.error("Error fetching transactions:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
