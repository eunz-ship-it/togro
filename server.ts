import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { runApi } from './server/api';

const app = express();
const { values } = parseArgs({
  options: { port: { type: 'string' }, host: { type: 'string' } },
  strict: false,
});
const port = Number(values.port || process.env.PORT) || 3000;
const host = String(values.host || '0.0.0.0');

app.use(express.json({ limit: '1mb' }));
app.use('/api', async (req, res) => {
  const response = await runApi(req.method, new URL(req.originalUrl, 'http://localhost'), req.body, process.env);
  res.status(response.status).set('Cache-Control', 'no-store').type('application/json').send(await response.text());
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(port, host, () => console.log('TO-GROW: port ' + port));
}

void startServer();
