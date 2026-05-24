import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Categories
  const categories = [
    { name: "Supermercado", emoji: "🛒" },
    { name: "Transporte", emoji: "🚗" },
    { name: "Entretenimiento", emoji: "🎬" },
    { name: "Salud", emoji: "💊" },
    { name: "Restaurant", emoji: "🍕" },
    { name: "Servicios", emoji: "📱" },
    { name: "Hogar", emoji: "🏠" },
    { name: "Educación", emoji: "📚" },
    { name: "Sueldo", emoji: "💰" },
    { name: "Transferencia", emoji: "🔄" },
    { name: "Otro", emoji: "📌" },
    { name: "Alimento", emoji: "🍽️" },
    { name: "Café", emoji: "☕" },
    { name: "Mascotas", emoji: "🐾" },
    { name: "Vivienda", emoji: "🏡" },
    { name: "Servicios Básicos", emoji: "💡" },
    { name: "Suscripciones", emoji: "📺" },
    { name: "Ropa y Calzado", emoji: "👟" },
    { name: "Deporte", emoji: "🏋️" },
    { name: "Regalos", emoji: "🎁" },
    { name: "Viajes", emoji: "✈️" },
    { name: "Impuestos", emoji: "🧾" },
    { name: "Comisiones Bancarias", emoji: "🏦" },
    { name: "Donaciones", emoji: "💝" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  const catMap: Record<string, number> = {};
  const allCats = await prisma.category.findMany();
  for (const c of allCats) catMap[c.name] = c.id;

  // Accounts
  const accounts = [
    { name: "Cuenta Corriente", type: "checking", bank: "Banco de Chile", balance: 1200000, color: "#6366f1" },
    { name: "Visa Crédito", type: "credit_card", bank: "Banco de Chile", balance: -450000, color: "#a78bfa" },
    { name: "Cuenta Vista", type: "checking", bank: "BancoEstado", balance: 180000, color: "#38a169" },
  ];

  const createdAccounts: { id: number; name: string }[] = [];
  for (const acc of accounts) {
    const existing = await prisma.account.findFirst({ where: { name: acc.name, bank: acc.bank } });
    if (existing) {
      createdAccounts.push(existing);
    } else {
      const created = await prisma.account.create({ data: acc });
      createdAccounts.push(created);
    }
  }

  const [ctaCte, visa, ctaVista] = createdAccounts;

  // Check if transactions already exist
  const txnCount = await prisma.transaction.count();
  if (txnCount > 0) {
    console.log(`Already have ${txnCount} transactions, skipping seed.`);
    return;
  }

  // Transactions — 3 months of realistic Chilean data
  const txns: { date: string; desc: string; amount: number; accountId: number; cat: string }[] = [
    // === APRIL 2026 ===
    { date: "2026-04-11", desc: "Líder Express", amount: -67890, accountId: visa.id, cat: "Supermercado" },
    { date: "2026-04-10", desc: "Uber", amount: -4350, accountId: ctaCte.id, cat: "Transporte" },
    { date: "2026-04-09", desc: "Netflix", amount: -6500, accountId: visa.id, cat: "Entretenimiento" },
    { date: "2026-04-08", desc: "Jumbo Kennedy", amount: -94320, accountId: visa.id, cat: "Supermercado" },
    { date: "2026-04-07", desc: "Copec Vitacura", amount: -42000, accountId: ctaCte.id, cat: "Transporte" },
    { date: "2026-04-06", desc: "Rappi - Papa John's", amount: -18900, accountId: visa.id, cat: "Restaurant" },
    { date: "2026-04-05", desc: "Sueldo Abril", amount: 1800000, accountId: ctaCte.id, cat: "Sueldo" },
    { date: "2026-04-04", desc: "Farmacias Ahumada", amount: -12300, accountId: visa.id, cat: "Salud" },
    { date: "2026-04-03", desc: "Entel Móvil", amount: -24990, accountId: ctaCte.id, cat: "Servicios" },
    { date: "2026-04-02", desc: "Santa Isabel", amount: -38450, accountId: ctaVista.id, cat: "Supermercado" },
    { date: "2026-04-01", desc: "Spotify", amount: -5490, accountId: visa.id, cat: "Entretenimiento" },

    // === MARCH 2026 ===
    { date: "2026-03-31", desc: "Líder Maipú", amount: -82350, accountId: visa.id, cat: "Supermercado" },
    { date: "2026-03-30", desc: "Uber Eats", amount: -15600, accountId: ctaCte.id, cat: "Restaurant" },
    { date: "2026-03-29", desc: "Steam", amount: -12990, accountId: visa.id, cat: "Entretenimiento" },
    { date: "2026-03-28", desc: "Transferencia a BancoEstado", amount: -100000, accountId: ctaCte.id, cat: "Transferencia" },
    { date: "2026-03-28", desc: "Transferencia desde Banco Chile", amount: 100000, accountId: ctaVista.id, cat: "Transferencia" },
    { date: "2026-03-27", desc: "VTR Internet", amount: -35990, accountId: ctaCte.id, cat: "Servicios" },
    { date: "2026-03-26", desc: "Farmacias Cruz Verde", amount: -8900, accountId: ctaVista.id, cat: "Salud" },
    { date: "2026-03-25", desc: "Copec Las Condes", amount: -48000, accountId: ctaCte.id, cat: "Transporte" },
    { date: "2026-03-24", desc: "Jumbo Costanera", amount: -112500, accountId: visa.id, cat: "Supermercado" },
    { date: "2026-03-23", desc: "Sushi House", amount: -32000, accountId: visa.id, cat: "Restaurant" },
    { date: "2026-03-22", desc: "Uber", amount: -5800, accountId: ctaCte.id, cat: "Transporte" },
    { date: "2026-03-21", desc: "Enel Distribución", amount: -42300, accountId: ctaCte.id, cat: "Servicios" },
    { date: "2026-03-20", desc: "Aguas Andinas", amount: -18500, accountId: ctaCte.id, cat: "Servicios" },
    { date: "2026-03-19", desc: "Bip! Recarga", amount: -10000, accountId: ctaVista.id, cat: "Transporte" },
    { date: "2026-03-18", desc: "Mercado Libre", amount: -45900, accountId: visa.id, cat: "Hogar" },
    { date: "2026-03-17", desc: "iFood - Dominó's", amount: -14500, accountId: visa.id, cat: "Restaurant" },
    { date: "2026-03-16", desc: "Sodimac", amount: -58700, accountId: ctaCte.id, cat: "Hogar" },
    { date: "2026-03-15", desc: "Farmacias Ahumada", amount: -9200, accountId: visa.id, cat: "Salud" },
    { date: "2026-03-14", desc: "Líder Express", amount: -45600, accountId: visa.id, cat: "Supermercado" },
    { date: "2026-03-13", desc: "Uber", amount: -3900, accountId: ctaCte.id, cat: "Transporte" },
    { date: "2026-03-12", desc: "Netflix", amount: -6500, accountId: visa.id, cat: "Entretenimiento" },
    { date: "2026-03-11", desc: "Easy", amount: -23400, accountId: ctaCte.id, cat: "Hogar" },
    { date: "2026-03-10", desc: "Santa Isabel", amount: -52300, accountId: ctaVista.id, cat: "Supermercado" },
    { date: "2026-03-09", desc: "Rappi - McDonald's", amount: -8900, accountId: visa.id, cat: "Restaurant" },
    { date: "2026-03-08", desc: "Copec Providencia", amount: -38000, accountId: ctaCte.id, cat: "Transporte" },
    { date: "2026-03-07", desc: "Entel Móvil", amount: -24990, accountId: ctaCte.id, cat: "Servicios" },
    { date: "2026-03-06", desc: "Jumbo La Dehesa", amount: -76800, accountId: visa.id, cat: "Supermercado" },
    { date: "2026-03-05", desc: "Sueldo Marzo", amount: 1800000, accountId: ctaCte.id, cat: "Sueldo" },
    { date: "2026-03-04", desc: "Spotify", amount: -5490, accountId: visa.id, cat: "Entretenimiento" },
    { date: "2026-03-03", desc: "Uber", amount: -6200, accountId: ctaCte.id, cat: "Transporte" },
    { date: "2026-03-02", desc: "Líder Online", amount: -95400, accountId: visa.id, cat: "Supermercado" },
    { date: "2026-03-01", desc: "Gimnasio Pacific", amount: -35000, accountId: ctaCte.id, cat: "Salud" },

    // === FEBRUARY 2026 ===
    { date: "2026-02-28", desc: "Líder Express", amount: -71200, accountId: visa.id, cat: "Supermercado" },
    { date: "2026-02-27", desc: "Uber", amount: -7100, accountId: ctaCte.id, cat: "Transporte" },
    { date: "2026-02-26", desc: "Rappi - Burger King", amount: -11500, accountId: visa.id, cat: "Restaurant" },
    { date: "2026-02-25", desc: "VTR Internet", amount: -35990, accountId: ctaCte.id, cat: "Servicios" },
    { date: "2026-02-24", desc: "Farmacias Cruz Verde", amount: -15800, accountId: ctaVista.id, cat: "Salud" },
    { date: "2026-02-23", desc: "Copec Ñuñoa", amount: -41000, accountId: ctaCte.id, cat: "Transporte" },
    { date: "2026-02-22", desc: "Jumbo Bilbao", amount: -88900, accountId: visa.id, cat: "Supermercado" },
    { date: "2026-02-21", desc: "La Fuente Alemana", amount: -28000, accountId: visa.id, cat: "Restaurant" },
    { date: "2026-02-20", desc: "Bip! Recarga", amount: -15000, accountId: ctaVista.id, cat: "Transporte" },
    { date: "2026-02-19", desc: "Enel Distribución", amount: -38700, accountId: ctaCte.id, cat: "Servicios" },
    { date: "2026-02-18", desc: "Mercado Libre", amount: -32500, accountId: visa.id, cat: "Hogar" },
    { date: "2026-02-17", desc: "Uber Eats", amount: -19200, accountId: ctaCte.id, cat: "Restaurant" },
    { date: "2026-02-16", desc: "Netflix", amount: -6500, accountId: visa.id, cat: "Entretenimiento" },
    { date: "2026-02-15", desc: "Santa Isabel", amount: -43600, accountId: ctaVista.id, cat: "Supermercado" },
    { date: "2026-02-14", desc: "Flores - Día de los Enamorados", amount: -25000, accountId: ctaCte.id, cat: "Otro" },
    { date: "2026-02-13", desc: "Cena San Valentín", amount: -65000, accountId: visa.id, cat: "Restaurant" },
    { date: "2026-02-12", desc: "Netflix", amount: -6500, accountId: visa.id, cat: "Entretenimiento" },
    { date: "2026-02-11", desc: "Copec Vitacura", amount: -44000, accountId: ctaCte.id, cat: "Transporte" },
    { date: "2026-02-10", desc: "Líder Maipú", amount: -67800, accountId: visa.id, cat: "Supermercado" },
    { date: "2026-02-09", desc: "Entel Móvil", amount: -24990, accountId: ctaCte.id, cat: "Servicios" },
    { date: "2026-02-08", desc: "Aguas Andinas", amount: -16200, accountId: ctaCte.id, cat: "Servicios" },
    { date: "2026-02-07", desc: "Farmacias Ahumada", amount: -11300, accountId: visa.id, cat: "Salud" },
    { date: "2026-02-06", desc: "Uber", amount: -4800, accountId: ctaCte.id, cat: "Transporte" },
    { date: "2026-02-05", desc: "Sueldo Febrero", amount: 1800000, accountId: ctaCte.id, cat: "Sueldo" },
    { date: "2026-02-04", desc: "Spotify", amount: -5490, accountId: visa.id, cat: "Entretenimiento" },
    { date: "2026-02-03", desc: "Jumbo Kennedy", amount: -98500, accountId: visa.id, cat: "Supermercado" },
    { date: "2026-02-02", desc: "Sodimac", amount: -42300, accountId: ctaCte.id, cat: "Hogar" },
    { date: "2026-02-01", desc: "Gimnasio Pacific", amount: -35000, accountId: ctaCte.id, cat: "Salud" },
  ];

  for (const t of txns) {
    await prisma.transaction.create({
      data: {
        date: new Date(t.date),
        description: t.desc,
        amount: t.amount,
        accountId: t.accountId,
        categoryId: catMap[t.cat],
      },
    });
  }

  console.log(`Seeded ${categories.length} categories, ${accounts.length} accounts, ${txns.length} transactions`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
