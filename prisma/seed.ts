import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Categories
  const categories = [
    { name: 'Supermercado', emoji: '🛒' },
    { name: 'Transporte', emoji: '🚗' },
    { name: 'Entretenimiento', emoji: '🎬' },
    { name: 'Salud', emoji: '💊' },
    { name: 'Restaurant', emoji: '🍕' },
    { name: 'Servicios', emoji: '📱' },
    { name: 'Hogar', emoji: '🏠' },
    { name: 'Educación', emoji: '📚' },
    { name: 'Sueldo', emoji: '💰' },
    { name: 'Transferencia', emoji: '🔄' },
    { name: 'Otro', emoji: '📌' },
    { name: 'Alimento', emoji: '🍽️' },
    { name: 'Café', emoji: '☕' },
    { name: 'Mascotas', emoji: '🐾' },
    { name: 'Vivienda', emoji: '🏡' },
    { name: 'Servicios Básicos', emoji: '💡' },
    { name: 'Suscripciones', emoji: '📺' },
    { name: 'Ropa y Calzado', emoji: '👟' },
    { name: 'Deporte', emoji: '🏋️' },
    { name: 'Regalos', emoji: '🎁' },
    { name: 'Viajes', emoji: '✈️' },
    { name: 'Impuestos', emoji: '🧾' },
    { name: 'Comisiones Bancarias', emoji: '🏦' },
    { name: 'Donaciones', emoji: '💝' },
    // New categories required by the merchant rules (issue #23 / PRD #22).
    { name: 'Streaming', emoji: '📺' },
    { name: 'Seguros', emoji: '🛡️' },
    { name: 'Tecnología', emoji: '💻' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  console.log(`Seeded ${categories.length} categories`);

  // Resolve category names to ids for rule seeding.
  const catMap: Record<string, number> = {};
  for (const c of await prisma.category.findMany()) catMap[c.name] = c.id;

  // Categorization rules seeded from the real 47-entry merchant list (PRD #22).
  // `match` is stored as entered (casing preserved) but matched case-insensitively.
  // Each category label is normalized to a real Category.
  const ruleSeeds: { match: string; category: string }[] = [
    // Supermercado
    { match: 'Jumbo', category: 'Supermercado' },
    { match: 'Lider', category: 'Supermercado' },
    { match: 'Santa Isabel', category: 'Supermercado' },
    { match: 'Unimarc', category: 'Supermercado' },
    { match: 'Tottus', category: 'Supermercado' },
    { match: 'Acuenta', category: 'Supermercado' },
    { match: 'Ekono', category: 'Supermercado' },
    // Alimento / Café
    { match: 'Murta', category: 'Alimento' },
    { match: 'Starbucks', category: 'Café' },
    { match: 'Juan Valdez', category: 'Café' },
    // Restaurant / delivery
    { match: 'Uber Eats', category: 'Restaurant' },
    { match: 'Rappi', category: 'Restaurant' },
    { match: 'Pedidos Ya', category: 'Restaurant' },
    { match: 'McDonald', category: 'Restaurant' },
    // Transporte
    { match: 'Uber', category: 'Transporte' },
    { match: 'Cabify', category: 'Transporte' },
    { match: 'DiDi', category: 'Transporte' },
    { match: 'Copec', category: 'Transporte' },
    { match: 'Shell', category: 'Transporte' },
    { match: 'Metro', category: 'Transporte' },
    { match: 'Bip', category: 'Transporte' },
    // Streaming
    { match: 'Netflix', category: 'Streaming' },
    { match: 'Spotify', category: 'Streaming' },
    { match: 'Disney', category: 'Streaming' },
    { match: 'HBO Max', category: 'Streaming' },
    { match: 'MUBI', category: 'Streaming' },
    { match: 'Prime Video', category: 'Streaming' },
    { match: 'YouTube Premium', category: 'Streaming' },
    // Entretenimiento (gaming)
    { match: 'Steam', category: 'Entretenimiento' },
    { match: 'PlayStation', category: 'Entretenimiento' },
    // Tecnología / marketplaces
    { match: 'MERPAGO*ALIPAYSINGA', category: 'Tecnología' },
    { match: 'AliExpress', category: 'Tecnología' },
    { match: 'Mercado Libre', category: 'Tecnología' },
    // Ropa y Calzado (multitiendas)
    { match: 'Falabella', category: 'Ropa y Calzado' },
    { match: 'Ripley', category: 'Ropa y Calzado' },
    { match: 'Paris', category: 'Ropa y Calzado' },
    // Hogar
    { match: 'Sodimac', category: 'Hogar' },
    { match: 'Easy', category: 'Hogar' },
    { match: 'IKEA', category: 'Hogar' },
    // Salud
    { match: 'Farmacias Ahumada', category: 'Salud' },
    { match: 'Cruz Verde', category: 'Salud' },
    { match: 'Salcobrand', category: 'Salud' },
    // Servicios / Servicios Básicos
    { match: 'Entel', category: 'Servicios' },
    { match: 'Movistar', category: 'Servicios' },
    { match: 'VTR', category: 'Servicios Básicos' },
    { match: 'Enel', category: 'Servicios Básicos' },
    // Seguros
    { match: 'Consorcio Seguros', category: 'Seguros' },
  ];

  // Idempotent: upsert on the unique `match` so re-seeding refreshes the
  // category instead of duplicating rules.
  for (const r of ruleSeeds) {
    const categoryId = catMap[r.category];
    if (!categoryId) throw new Error(`Unknown category for rule: ${r.category}`);
    await prisma.rule.upsert({
      where: { match: r.match },
      update: { categoryId },
      create: { match: r.match, categoryId },
    });
  }

  console.log(`Seeded ${ruleSeeds.length} rules`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
