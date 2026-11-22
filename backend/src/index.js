import legacy from './legacy.js';
import { PREFIX, seasonRequest } from './season.js';
import { appStorePage } from './app-store-pages.js';

const oldOrigins = new Set(['https://mamdanirun.cc', 'https://www.mamdanirun.cc']);
const oldDomainCutoff = Date.parse('2026-11-21T14:00:00Z');

const closedRoutes = new Set(['/register', '/score', '/feedback']);

// The original module trusts public player IDs, so only its reads stay open, without the IDs.
async function legacyRequest(request, env, ctx, path) {
    if (request.method === 'OPTIONS') return legacy.fetch(request, env, ctx);
    if (closedRoutes.has(path)) {
        return Response.json({ ok: false, error: 'Update the game to play online.' }, { status: 410 });
    }
    if (request.method !== 'GET' || !['/health', '/leaderboard'].includes(path)) {
        return Response.json({ error: 'Not found' }, { status: 404 });
    }
    const result = await legacy.fetch(request, env, ctx);
    if (path !== '/leaderboard' || !result.ok) return result;
    const { entries } = await result.json();
    return Response.json({
        entries: entries.map(({ name, social, score, created_at }) => ({ name, social, score, created_at }))
    });
}

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
            : await legacyRequest(request, env, ctx, path);
        const response = new Response(result.body, result);
        const allowedOrigin = oldOrigin || origin === 'https://www.mamdanirun.com' ? origin : env.CORS || 'https://mamdanirun.com';
        response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
        response.headers.append('Vary', 'Origin');
        return response;
    }
};
