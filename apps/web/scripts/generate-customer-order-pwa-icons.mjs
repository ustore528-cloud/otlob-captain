/**
 * Composite brand mark with safe padding for maskable / launcher icons.
 * Run from apps/web: node ./scripts/generate-customer-order-pwa-icons.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = path.join(root, "src", "assets", "brand-2in.png");

/** Soft neutral background (customer flow — not admin burgundy fill) */
const BG = "#f8fafc";

async function tileIcon(px, maxLogoSideRatio) {
  const maxLogo = px * maxLogoSideRatio;
  const logoBuf = await sharp(logoPath)
    .resize(Math.round(maxLogo), Math.round(maxLogo), {
      fit: "inside",
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const meta = await sharp(logoBuf).metadata();
  const lw = meta.width ?? 1;
  const lh = meta.height ?? 1;
  const left = Math.round((px - lw) / 2);
  const top = Math.round((px - lh) / 2);

  return sharp({
    create: { width: px, height: px, channels: 4, background: BG },
  })
    .composite([{ input: logoBuf, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const out = path.join(root, "public");
  /** “any”: logo uses ~72% safe zone centre */
  await sharp(await tileIcon(192, 0.58)).toFile(path.join(out, "customer-order-icon-192.png"));
  await sharp(await tileIcon(512, 0.58)).toFile(path.join(out, "customer-order-icon-512-any.png"));
  /** maskable: stronger padding (~52% of edge) for circle/squircle crops */
  await sharp(await tileIcon(512, 0.48)).toFile(path.join(out, "customer-order-icon-512-maskable.png"));
  await sharp(await tileIcon(192, 0.58))
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, "customer-order-icon-180.png"));

  // eslint-disable-next-line no-console
  console.info("Wrote customer-order-icon-*.png → apps/web/public/");
}

await main();
