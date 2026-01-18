import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { optimize as svgoOptimize } from "svgo";
import { Resvg } from "@resvg/resvg-js";

const INPUT_DIR = path.resolve("public/source");
const OUT_DIR   = path.resolve("public/processed");

const widths = [640, 960, 1280, 1920, 2560];

const LQIP_WIDTH = 20;
const MASK_SIZE_FALLBACK = 1024;

async function ensureDir(p) {
  try { await fs.mkdir(p, { recursive: true }); } catch {}
}
const isSvg = (f) => /\.svg$/i.test(f);

/** Optimize raw SVG text (shrinks huge path data, removes cruft). */
function optimizeSvgText(svgText) {
  const { data } = svgoOptimize(svgText, {
    multipass: true,
    plugins: [
      "preset-default",
      { name: "removeViewBox", active: false }, // keep viewBox for scaling
      { name: "cleanupNumericValues", params: { floatPrecision: 3 } },
    ],
  });
  return data;
}

/** Render SVG text to PNG buffer at a given width using Resvg (avoids libxml limits). */
function renderSvgToPngBuffer(svgText, width) {
  const r = new Resvg(svgText, {
    fitTo: width ? { mode: "width", value: width } : undefined,
    background: "rgba(0,0,0,0)",
  });
  const png = r.render();
  return png.asPng(); // Buffer
}

async function lqipBuffer(inputPath) {
  if (isSvg(inputPath)) {
    const raw = await fs.readFile(inputPath, "utf8");
    const optimized = optimizeSvgText(raw);
    const pngBuf = renderSvgToPngBuffer(optimized, LQIP_WIDTH * 4); // render a bit larger, then blur
    const buf = await sharp(pngBuf).resize({ width: LQIP_WIDTH }).blur(8).jpeg({ quality: 60 }).toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } else {
    const buf = await sharp(inputPath).rotate().resize({ width: LQIP_WIDTH }).blur(8).jpeg({ quality: 60 }).toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  }
}

async function exportRasterSet(inputPath, outDir, base) {
  if (isSvg(inputPath)) {
    const raw = await fs.readFile(inputPath, "utf8");
    const optimized = optimizeSvgText(raw);

    // Save a large PNG fallback (largest width)
    const largest = Math.max(...widths);
    const bigPng = renderSvgToPngBuffer(optimized, largest);
    await sharp(bigPng).png({ compressionLevel: 9 }).toFile(path.join(outDir, `${base}.png`));

    // AVIF + WebP at each width
    for (const w of widths) {
      const png = renderSvgToPngBuffer(optimized, w);
      await sharp(png).avif({ quality: 50 }).toFile(path.join(outDir, `${base}-${w}.avif`));
      await sharp(png).webp({ quality: 75 }).toFile(path.join(outDir, `${base}-${w}.webp`));
    }

    // also save optimized SVG (useful to serve as-is if you want)
    await fs.writeFile(path.join(outDir, `${base}.svg`), optimized, "utf8");
  } else {
    // bitmap originals
    const img = sharp(inputPath).rotate();
    const largest = Math.max(...widths);
    await img.clone().resize({ width: largest, withoutEnlargement: true }).png({ compressionLevel: 9 })
      .toFile(path.join(outDir, `${base}.png`));

    for (const w of widths) {
      await img.clone().resize({ width: w, withoutEnlargement: true })
        .avif({ quality: 50 }).toFile(path.join(outDir, `${base}-${w}.avif`));
      await img.clone().resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 75 }).toFile(path.join(outDir, `${base}-${w}.webp`));
    }
  }
}

async function exportMasks(inputPath, outDir, base) {
  let squareSource; // a square PNG buffer to composite masks on
  if (isSvg(inputPath)) {
    const raw = await fs.readFile(inputPath, "utf8");
    const optimized = optimizeSvgText(raw);

    // Estimate size to render: use largest intended width, then square-crop
    const largest = Math.max(...widths, MASK_SIZE_FALLBACK);
    const png = renderSvgToPngBuffer(optimized, largest);
    squareSource = await sharp(png).resize({ width: largest, height: largest, fit: "cover" }).png().toBuffer();
  } else {
    // bitmap: read metadata then square-crop
    const meta = await sharp(inputPath).metadata();
    const size = Math.max(1, Math.min(meta.width ?? MASK_SIZE_FALLBACK, meta.height ?? MASK_SIZE_FALLBACK));
    squareSource = await sharp(inputPath).rotate().resize(size, size, { fit: "cover" }).png().toBuffer();
  }

  // build circle + rounded masks
  // infer size from buffer
  const meta = await sharp(squareSource).metadata();
  const size = Math.max(1, Math.min(meta.width ?? MASK_SIZE_FALLBACK, meta.height ?? MASK_SIZE_FALLBACK));

  const circle = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <circle cx="${size/2}" cy="${size/2}" r="${size/2}" />
     </svg>`
  );
  const r = 24;
  const rounded = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" />
     </svg>`
  );

  await sharp(squareSource).composite([{ input: circle, blend: "dest-in" }]).png()
    .toFile(path.join(outDir, `${base}-circle.png`));
  await sharp(squareSource).composite([{ input: rounded, blend: "dest-in" }]).png()
    .toFile(path.join(outDir, `${base}-rounded.png`));
}

async function processOne(file) {
  const inPath = path.join(INPUT_DIR, file);
  const base = path.parse(file).name;
  const outDir = path.join(OUT_DIR, base);
  await ensureDir(outDir);

  // LQIP
  const placeholder = await lqipBuffer(inPath);
  await fs.writeFile(path.join(outDir, "placeholder.txt"), placeholder, "utf8");

  // Raster sets (handles SVG via Resvg)
  await exportRasterSet(inPath, outDir, base);

  // Masks (circle & rounded)
  await exportMasks(inPath, outDir, base);
}

async function main() {
  await ensureDir(OUT_DIR);
  const files = (await fs.readdir(INPUT_DIR)).filter(f =>
    /\.(jpe?g|png|webp|tiff|avif|svg)$/i.test(f)
  );
  await Promise.all(files.map(processOne));
  console.log("✅ Images processed (with SVG optimize + Resvg fallback).");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
