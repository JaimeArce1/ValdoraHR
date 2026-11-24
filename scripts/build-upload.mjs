// Prepara il pacchetto da caricare su Netlify con "Upload your project files":
// dist/netlify-upload/ e dist/valdora-hr-netlify.zip.
// La funzione è già impacchettata con esbuild (seed e @netlify/blobs inclusi), così il
// deploy non dipende da un `npm install` durante il caricamento.
// Uso: node scripts/build-upload.mjs   (richiede `npm install` fatto in questa cartella)
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { crc32, deflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = `${root}dist/netlify-upload`;
const zip = `${root}dist/valdora-hr-netlify.zip`;

rmSync(out, { recursive: true, force: true });
rmSync(zip, { force: true });
mkdirSync(`${out}/netlify/functions`, { recursive: true });

cpSync(`${root}public`, `${out}/public`, { recursive: true });

await build({
  entryPoints: [`${root}netlify/functions/site.mjs`],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // Alcune dipendenze usano require(): in un bundle ESM serve un require vero.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  outfile: `${out}/netlify/functions/site.mjs`,
  logLevel: "warning",
});

writeFileSync(
  `${out}/netlify.toml`,
  `# Valdora HR 1.0, pacchetto per il caricamento manuale su Netlify.
# Nessun passo di build: la funzione è già impacchettata.
[build]
  publish = "public"

[build.environment]
  NODE_VERSION = "22"

[functions]
  directory = "netlify/functions"

[[headers]]
  for = "/*"
  [headers.values]
    X-Robots-Tag = "noindex, nofollow"
`,
);

writeZip(zip, out, ["netlify.toml", "public", "netlify"]);
console.log(`Pronto: ${zip}`);

/** Zip minimale (deflate) dei percorsi dati, relativi a `base`, con separatori `/`. */
function writeZip(target, base, entries) {
  const files = [];
  const walk = (rel) => {
    const full = `${base}/${rel}`;
    if (statSync(full).isDirectory()) for (const name of readdirSync(full).sort()) walk(`${rel}/${name}`);
    else files.push(rel);
  };
  entries.forEach(walk);
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const name of files) {
    const data = readFileSync(`${base}/${name}`);
    const packed = deflateRawSync(data);
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nomi in UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(0, 10); // ora e data DOS (non usate)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, packed);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(20, 6);
    head.writeUInt16LE(0x0800, 8);
    head.writeUInt16LE(8, 10);
    head.writeUInt32LE(0, 12);
    head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(packed.length, 20);
    head.writeUInt32LE(data.length, 24);
    head.writeUInt16LE(nameBuf.length, 28);
    head.writeUInt32LE(offset, 42);
    central.push(head, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(target, Buffer.concat([...chunks, centralBuf, end]));
}
