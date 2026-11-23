import { runApi, type RuntimeEnv } from './api';

type WorkerEnv = RuntimeEnv & { ASSETS?: { fetch(request: Request): Promise<Response> } };

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Asset binding unavailable', { status: 503 });
    }
    let body: unknown;
    if (request.method === 'POST') {
      if (Number(request.headers.get('content-length')) > 1_048_576) {
        return Response.json({ error: '요청 내용이 너무 길어요.' }, { status: 413 });
      }
      try {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 1_048_576) {
          return Response.json({ error: '요청 내용이 너무 길어요.' }, { status: 413 });
        }
        body = JSON.parse(raw);
      } catch {
        return Response.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 });
      }
    }
    return runApi(request.method, url, body, env);
  },
};
