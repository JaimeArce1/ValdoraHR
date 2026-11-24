// Server locale: stesso gestore della funzione Netlify, sessioni in memoria.
// Uso: node dev/server.mjs  (porta da PORT, default 8888)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../src/handler.js";
import { memoryStore } from "../src/memory-store.js";

const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));
const PORT = Number(process.env.PORT || 8888);
const TYPES = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml" };

const sessions = memoryStore();

async function staticFile(pathname) {
  if (!pathname.startsWith("/assets/") && pathname !== "/robots.txt") return null;
  const file = normalize(join(PUBLIC_DIR, pathname));
  if (!file.startsWith(normalize(PUBLIC_DIR))) return null;
  try {
    const body = await readFile(file);
    return { body, type: TYPES[extname(file)] || "application/octet-stream" };
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const asset = await staticFile(url.pathname);
    if (asset) {
      res.writeHead(200, { "content-type": asset.type });
      res.end(asset.body);
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
    const response = await handle(request, sessions);
    const headers = {};
    response.headers.forEach((value, key) => {
      if (key !== "set-cookie") headers[key] = value;
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) headers["set-cookie"] = cookies;
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("Errore interno");
  }
}).listen(PORT, () => console.log(`Valdora HR in locale: http://localhost:${PORT}`));
