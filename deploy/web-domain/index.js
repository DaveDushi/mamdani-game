// The Pages workflow publishes the game under a repository subpath.
const pagesOrigin = 'https://davedushi.github.io';
const pagesPath = '/mamdani-game';
const transferEndsAt = Date.parse('2026-11-21T14:00:00Z');

export default {
    async fetch(request) {
        const url = new URL(request.url);
        if (url.hostname.startsWith('www.') || url.protocol !== 'https:') {
            url.hostname = url.hostname.replace(/^www\./, '');
            url.protocol = 'https:';
            return Response.redirect(url.href, 308);
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
        }
        const transfer = url.hostname === 'mamdanirun.com' && url.pathname === '/transfer-save.html';
        if (transfer && Date.now() >= transferEndsAt) {
            return new Response(null, { status: 410, headers: { 'Cache-Control': 'no-store' } });
        }

        const upstream = new URL(pagesOrigin);
        upstream.pathname = pagesPath + url.pathname;
        upstream.search = url.search;
        const headers = new Headers();
        for (const name of ['Accept', 'Range', 'If-None-Match', 'If-Modified-Since', 'If-Range']) {
            if (request.headers.has(name)) headers.set(name, request.headers.get(name));
        }
        const options = { method: request.method, headers, redirect: 'manual' };
        let response = await fetch(upstream, options);
        // GitHub's CDN can briefly cache its former custom-domain redirect.
        if (response.status === 301 && new URL(response.headers.get('Location') || '', upstream).origin !== pagesOrigin) {
            upstream.searchParams.append('__pages_origin', '20261120');
            response = await fetch(upstream, options);
        }
        const location = response.headers.get('Location');
        if (location && response.status >= 300 && response.status < 400) {
            const target = new URL(location, upstream);
            if (target.origin === pagesOrigin && target.pathname.startsWith(pagesPath + '/')) {
                url.pathname = target.pathname.slice(pagesPath.length);
                url.search = target.search;
                url.hash = target.hash;
                return Response.redirect(url.href, response.status);
            }
        }
        if (!transfer) return response;
        const fresh = new Response(response.body, response);
        fresh.headers.set('Cache-Control', 'no-store');
        return fresh;
    }
};
