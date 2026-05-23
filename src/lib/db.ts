import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

// On Vercel, the deployment bundle is read-only. Copy the build-time-seeded
// SQLite DB to /tmp on cold start so Prisma can read AND write to it.
if (process.env.VERCEL) {
  const target = "/tmp/dev.db";
  if (!fs.existsSync(target)) {
    const bundled = path.join(process.cwd(), "prisma", "dev.db");
    if (fs.existsSync(bundled)) {
      try {
        fs.copyFileSync(bundled, target, fs.constants.COPYFILE_EXCL);
      } catch {
        // Another concurrent worker already copied it. Safe to ignore.
      }
    }
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
