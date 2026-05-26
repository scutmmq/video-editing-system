const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // 简洁 URL → 实际文件路径映射
  let filePath;
  if (urlPath === '/') {
    filePath = path.join(ROOT, 'src', 'index.html');
  } else if (urlPath === '/login.html') {
    filePath = path.join(ROOT, 'src', 'pages', 'login.html');
  } else {
    filePath = path.join(ROOT, urlPath);
  }

  // 安全检查：防止路径遍历
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // COOP/COEP headers for SharedArrayBuffer (FFmpeg.wasm 多线程需要)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

  // WASM 文件额外 CORS 头
  if (ext === '.wasm') {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`服务器已启动：http://localhost:${PORT}`);
  console.log('FFmpeg.wasm 从本地 node_modules 加载');
});
