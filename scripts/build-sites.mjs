import { mkdir, rename, readdir, writeFile } from 'node:fs/promises';
import { build as bundleWorker } from 'esbuild';
import { build as bundleClient } from 'vite';

await bundleClient({ build: { emptyOutDir: true } });
const assets = await readdir('dist');
await mkdir('dist/client', { recursive: true });
for (const entry of assets) {
  await rename('dist/' + entry, 'dist/client/' + entry);
}

await bundleWorker({
  entryPoints: ['server/worker.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
});

await writeFile('dist/server/wrangler.json', JSON.stringify({
  main: 'index.js',
  compatibility_date: '2026-05-15',
  assets: { directory: '../client', binding: 'ASSETS', run_worker_first: ['/api/*'], not_found_handling: 'single-page-application' },
}, null, 2) + '\n');
