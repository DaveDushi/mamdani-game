import legacy from './legacy.js';
import { PREFIX, seasonRequest } from './season.js';
import { appStorePage } from './app-store-pages.js';

const oldOrigins = new Set(['https://mamdanirun.cc', 'https://www.mamdanirun.cc']);
const oldDomainCutoff = Date.parse('2026-11-21T14:00:00Z');

export default {
    ...legacy,
    async fetch(request, env, ctx) {
        const { hostname, pathname: path } = new URL(request.url);
        const origin = request.headers.get('Origin');
        const oldOrigin = oldOrigins.has(origin);
        if (Date.now() >= oldDomainCutoff) {
            if (hostname === 'api.mamdanirun.cc') return new Response('API moved to api.mamdanirun.com.', { status: 410 });
            if (oldOrigin) return new Response('Origin retired.', { status: 403, headers: { 'Cache-Control': 'no-store', 'Vary': 'Origin' } });
        }
        if (request.method === 'GET') {
            const page = appStorePage(path);
            if (page) return page;
        }
        const result = path.startsWith(PREFIX)
            ? await seasonRequest(request, env)
            : await legacy.fetch(request, env, ctx);
        const response = new Response(result.body, result);
        const allowedOrigin = oldOrigin || origin === 'https://www.mamdanirun.com' ? origin : env.CORS || 'https://mamdanirun.com';
        response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
        response.headers.append('Vary', 'Origin');
        return response;
    }
};
