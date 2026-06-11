import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';

function comfyProxyPlugin(): Plugin {
  return {
    name: 'comfy-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/comfyui-proxy',
        (req: IncomingMessage, res: ServerResponse) => {
          const target =
            (req.headers['x-comfy-target'] as string) ||
            extractParam(req.url || '', '_target');

          if (!target) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing proxy target' }));
            return;
          }

          let targetUrl: URL;
          try {
            targetUrl = new URL(req.url || '/', target.replace(/\/+$/, ''));
            targetUrl.searchParams.delete('_target');
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid target URL' }));
            return;
          }

          const isHttps = targetUrl.protocol === 'https:';
          const reqFn = isHttps ? httpsRequest : httpRequest;

          const fwdHeaders: Record<string, string> = {};
          for (const [key, val] of Object.entries(req.headers)) {
            if (['host', 'origin', 'referer', 'x-comfy-target'].includes(key)) continue;
            if (val) fwdHeaders[key] = Array.isArray(val) ? val[0] : val;
          }

          const proxyReq = reqFn(
            {
              hostname: targetUrl.hostname,
              port: targetUrl.port || (isHttps ? 443 : 80),
              path: targetUrl.pathname + targetUrl.search,
              method: req.method,
              headers: fwdHeaders,
              timeout: 30000,
            },
            (proxyRes) => {
              const resHeaders: Record<string, string | string[]> = {};
              for (const [key, val] of Object.entries(proxyRes.headers)) {
                if (val && key !== 'transfer-encoding') resHeaders[key] = val;
              }
              resHeaders['access-control-allow-origin'] = '*';

              res.writeHead(proxyRes.statusCode || 502, resHeaders);
              proxyRes.pipe(res);
            }
          );

          proxyReq.on('error', () => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({ error: 'Failed to reach ComfyUI' }));
          });

          proxyReq.on('timeout', () => {
            proxyReq.destroy();
            if (!res.headersSent) {
              res.writeHead(504, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({ error: 'ComfyUI request timed out' }));
          });

          req.pipe(proxyReq);
        }
      );
    },
  };
}

function extractParam(url: string, param: string): string | null {
  const match = url.match(new RegExp(`[?&]${param}=([^&]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default defineConfig({
  plugins: [react(), comfyProxyPlugin()],
  server: {
    host: '0.0.0.0',
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
