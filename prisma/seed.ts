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
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  console.log(`Seeded ${categories.length} categories`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
