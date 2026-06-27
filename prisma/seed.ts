import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Categories (seeded first so rules can FK into them). The last three
// — Streaming, Seguros, Tecnología — are new categories required by the
// rule seed below.
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
  // New categories needed by the rule seed.
  { name: 'Streaming', emoji: '📺' },
  { name: 'Seguros', emoji: '🛡️' },
  { name: 'Tecnología', emoji: '💻' },
];

// Maps a raw category label (as it appears in the merchant list) onto a real
// Category name. Keys are already normalized (lower-case, accent-free) so the
// lookup tolerates casing/accent variants in the source list.
const LABEL_TO_CATEGORY: Record<string, string> = {
  supermercado: 'Supermercado',
  transporte: 'Transporte',
  entretenimiento: 'Entretenimiento',
  salud: 'Salud',
  restaurant: 'Restaurant',
  restaurante: 'Restaurant',
  servicios: 'Servicios',
  hogar: 'Hogar',
  educacion: 'Educación',
  cafe: 'Café',
  streaming: 'Streaming',
  seguros: 'Seguros',
  tecnologia: 'Tecnología',
  otros: 'Otro',
  otro: 'Otro',
};

function normalizeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // strip combining diacritical marks
}

// The merchant seed: [match text (stored as entered), raw category label].
// Match text is compared case-insensitively and as a substring at sync time.
const RULE_SEED: [string, string][] = [
  ['Jumbo', 'supermercado'],
  ['Lider', 'supermercado'],
  ['Santa Isabel', 'supermercado'],
  ['Unimarc', 'supermercado'],
  ['Tottus', 'supermercado'],
  ['Murta', 'supermercado'],
  ['Acuenta', 'supermercado'],
  ['Uber Eats', 'restaurant'],
  ['Uber', 'transporte'],
  ['Cabify', 'transporte'],
  ['Didi', 'transporte'],
  ['Copec', 'transporte'],
  ['Shell', 'transporte'],
  ['Metro', 'transporte'],
  ['BIP', 'transporte'],
  ['Netflix', 'streaming'],
  ['Spotify', 'streaming'],
  ['MUBI', 'streaming'],
  ['Disney', 'streaming'],
  ['HBO', 'streaming'],
  ['YouTube Premium', 'streaming'],
  ['Prime Video', 'streaming'],
  ['Steam', 'entretenimiento'],
  ['PlayStation', 'entretenimiento'],
  ['Xbox', 'entretenimiento'],
  ['Farmacia Ahumada', 'salud'],
  ['Cruz Verde', 'salud'],
  ['Salcobrand', 'salud'],
  ['Rappi', 'restaurant'],
  ['Pedidos Ya', 'restaurant'],
  ['McDonald', 'restaurant'],
  ['Starbucks', 'cafe'],
  ['Juan Valdez', 'cafe'],
  ['Entel', 'servicios'],
  ['Movistar', 'servicios'],
  ['Claro', 'servicios'],
  ['WOM', 'servicios'],
  ['VTR', 'servicios'],
  ['Enel', 'servicios'],
  ['Aguas Andinas', 'servicios'],
  ['Sodimac', 'hogar'],
  ['Easy', 'hogar'],
  ['Mercado Libre', 'tecnologia'],
  ['AliExpress', 'tecnologia'],
  ['MERPAGO*ALIPAYSINGA', 'tecnologia'],
  ['Consorcio', 'seguros'],
  ['BICE Vida', 'seguros'],
];

async function main() {
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log(`Seeded ${categories.length} categories`);

  const cats = await prisma.category.findMany();
  const catByName: Record<string, number> = {};
  for (const c of cats) catByName[c.name] = c.id;

  let ruleCount = 0;
  for (const [match, rawLabel] of RULE_SEED) {
    const categoryName = LABEL_TO_CATEGORY[normalizeLabel(rawLabel)] ?? 'Otro';
    const categoryId = catByName[categoryName];
    if (!categoryId) {
      console.warn(`Skipping rule "${match}": unknown category "${categoryName}"`);
      continue;
    }
    // Idempotent: skip a rule already present (case-insensitively) so re-seeding
    // is safe. The NOCASE unique index is the hard guard against duplicates.
    const existing = await prisma.rule.findFirst({ where: { match } });
    if (existing) continue;
    await prisma.rule.create({ data: { match, categoryId } });
    ruleCount++;
  }
  console.log(`Seeded ${ruleCount} rules (of ${RULE_SEED.length})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
