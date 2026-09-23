import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const sessionId = 'mp-webhook-order';
const outdir = path.resolve('.dbg');
const host = '127.0.0.1';
const basePort = 7777;
const maxRetries = 10;
const idleSeconds = 1200;
const logFile = path.join(outdir, `trae-debug-log-${sessionId}.ndjson`);
const envFile = path.join(outdir, `${sessionId}.env`);

fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(logFile, '', 'utf8');

let lastActivity = Date.now();
let server;

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function writeEnvFile(port) {
  const apiUrl = `http://${host}:${port}/event`;
  fs.writeFileSync(
    envFile,
    `DEBUG_SERVER_URL=${apiUrl}\nDEBUG_SESSION_ID=${sessionId}\n`,
    'utf8'
  );
  return apiUrl;
}

function startOnPort(port, retries = 0) {
  server = http.createServer((req, res) => {
    lastActivity = Date.now();
    corsHeaders(res);
    if (req.method === 'OPTIONS' && req.url === '/event') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'POST' && req.url === '/event') {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        try {
          const event = JSON.parse(raw || '{}');
          if (!event.ts) event.ts = Date.now();
          fs.appendFileSync(logFile, `${JSON.stringify(event)}\n`, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid_json' }));
        }
      });
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  server.on('error', (error) => {
    if ((error && error.code === 'EADDRINUSE') && retries < maxRetries) {
      startOnPort(port + 1, retries + 1);
      return;
    }
    throw error;
  });

  server.listen(port, host, () => {
    const apiUrl = writeEnvFile(port);
    console.log('@@DEBUG_SERVER_INFO');
    console.log(JSON.stringify({
      api_url: apiUrl,
      session_id: sessionId,
      log_dir: outdir,
      log_file: logFile,
      env_file: envFile,
    }, null, 2));
    console.log('@@END_DEBUG_SERVER_INFO');
  });
}

setInterval(() => {
  if (Date.now() - lastActivity > idleSeconds * 1000) {
    server?.close(() => process.exit(0));
  }
}, 5000).unref();

startOnPort(basePort);
