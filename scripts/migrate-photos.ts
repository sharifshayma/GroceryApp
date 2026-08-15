import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import { isBlobUrl } from "../src/lib/blob";

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.item.findMany({
    where: { photoUrl: { not: null } },
    select: { id: true, name: true, photoUrl: true },
  });
  let moved = 0;
  let skipped = 0;
  for (const it of items) {
    if (!it.photoUrl || isBlobUrl(it.photoUrl)) {
      skipped++;
      continue;
    }
    const resp = await fetch(it.photoUrl);
    if (!resp.ok) {
      console.warn(`⚠️  skip (fetch ${resp.status}) ${it.name}`);
      continue;
    }
    const contentType = resp.headers.get("content-type") ?? "image/jpeg";
    const ext = (contentType.split("/")[1] ?? "jpg").split(";")[0];
    const buf = Buffer.from(await resp.arrayBuffer());
    const blob = await put(`items/${it.id}.${ext}`, buf, {
      access: "public",
      contentType,
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    await prisma.item.update({
      where: { id: it.id },
      data: { photoUrl: blob.url, photoPath: blob.pathname },
    });
    moved++;
    console.log(`moved ${it.name} → ${blob.url}`);
  }
  console.log(`✅ photos migrated: ${moved}, skipped (already Blob/none): ${skipped}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ photo migration failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
