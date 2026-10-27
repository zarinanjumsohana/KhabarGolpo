// Tiny static server for KhabarGolpo (no dependencies).
// Browsers block ES modules on file://, so open the site through this server.
//
//   node serve.mjs          -> http://localhost:5501
//   node serve.mjs 8080     -> http://localhost:8080

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { createSocket } from 'node:dgram';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.argv[2]) || 5501;

/* The address a phone on the same Wi-Fi should use. Asking the OS which local
   address routes to the internet skips virtual adapters (VirtualBox, Docker). */
let cachedIp = null;
function lanAddress() {
  if (cachedIp) return Promise.resolve(cachedIp);
  return new Promise((resolve) => {
    const sock = createSocket('udp4');
    const done = (ip) => {
      cachedIp = ip;
      try { sock.close(); } catch (e) { /* already closed */ }
      resolve(ip);
    };
    const fallback = () => {
      const all = Object.values(networkInterfaces())
        .flat()
        .filter((i) => i && i.family === 'IPv4' && !i.internal)
        .map((i) => i.address);
      done(all[0] || 'localhost');
    };
    sock.on('error', fallback);
    try {
      sock.connect(53, '8.8.8.8', () => {
        const ip = sock.address().address;
        done(ip && ip !== '0.0.0.0' ? ip : 'localhost');
      });
    } catch (e) {
      fallback();
    }
  });
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);

    /* Small helper used by the admin QR page: tells the browser which LAN
       address the phone should use when the panel is open on localhost. */
    if (pathname === '/__kg-host') {
      const ip = await lanAddress();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ip, port: PORT, origin: `http://${ip}:${PORT}` }));
      return;
    }

    if (pathname.endsWith('/')) pathname += 'index.html';

    const target = normalize(join(ROOT, pathname));
    if (!target.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let file = target;
    let info = await stat(file).catch(() => null);
    if (info && info.isDirectory()) {
      file = join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>404 — not found</h1><p>${pathname}</p><p><a href="/">Go to the site</a></p>`);
      return;
    }

    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error: ' + err.message);
  }
});

server.listen(PORT, async () => {
  const lan = await lanAddress();
  console.log(`KhabarGolpo is running at http://localhost:${PORT}`);
  if (lan !== 'localhost') {
    console.log(`Phone / QR link  : http://${lan}:${PORT}`);
    console.log('(open the admin panel on the line above so the QR codes work on a phone)');
  }
  console.log('Customer : /customer/');
  console.log('Admin    : /Admin%20Panel/admin/login.html');
  console.log('Kitchen  : /Kitchen%20Panel/html/login.html');
  console.log('Press Ctrl+C to stop.');
});
