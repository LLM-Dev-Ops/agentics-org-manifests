import http from 'http';
import {
  validateManifest,
  detectManifestType,
  MANIFEST_TYPES,
  CURRENT_SCHEMA_VERSION,
  REPOSITORY_INFO,
} from './index.js';

const PORT = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'healthy', service: 'agentics-manifests' }));
    return;
  }

  // GET /v1/manifests - List manifest types and schema info
  if (url.pathname === '/v1/manifests' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      version: CURRENT_SCHEMA_VERSION,
      repository: REPOSITORY_INFO,
      manifestTypes: MANIFEST_TYPES,
      endpoints: {
        validate: 'POST /v1/manifests/validate',
        detect: 'POST /v1/manifests/detect',
      },
    }));
    return;
  }

  // POST /v1/manifests/validate - Validate a manifest
  if (url.pathname === '/v1/manifests/validate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const manifest = JSON.parse(body);
        const result = validateManifest(manifest);
        res.writeHead(result.valid ? 200 : 400);
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ valid: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // POST /v1/manifests/detect - Detect manifest type
  if (url.pathname === '/v1/manifests/detect' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const manifest = JSON.parse(body);
        const type = detectManifestType(manifest);
        res.writeHead(200);
        res.end(JSON.stringify({ type }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 404 for unknown routes
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`agentics-manifests server listening on port ${PORT}`);
});
