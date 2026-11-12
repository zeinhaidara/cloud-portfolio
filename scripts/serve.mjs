import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function serve(port = 4173) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/cloud-portfolio/')) {
      res.writeHead(302, { Location: '/cloud-portfolio/' }); res.end(); return;
    }
    try {
      let path = resolve(root, '.' + decodeURIComponent(url.pathname.slice('/cloud-portfolio'.length)));
      if (!path.startsWith(resolve(root) + sep)) throw new Error('Outside root');
      if (statSync(path).isDirectory()) path = resolve(path, 'index.html');
      const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml' };
      const headers = { 'Content-Type': mime[extname(path)] || 'text/plain', 'Cache-Control': 'public, max-age=600', Vary: 'Accept-Encoding' };
      let body = readFileSync(path);
      if (/gzip/.test(req.headers['accept-encoding'] || '') && ['.html', '.css', '.js', '.xml'].includes(extname(path))) {
        body = gzipSync(body); headers['Content-Encoding'] = 'gzip';
      }
      res.writeHead(200, headers); res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html' }); res.end(readFileSync(resolve(root, '404.html')));
    }
  }).listen(port, '127.0.0.1');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  serve(); console.log('Local: http://127.0.0.1:4173/cloud-portfolio/');
}
