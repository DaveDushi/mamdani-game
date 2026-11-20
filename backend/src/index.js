import legacy from './legacy.js';
import { PREFIX, seasonRequest } from './season.js';
import { appStorePage } from './app-store-pages.js';

export default {
    ...legacy,
    fetch(request, env, ctx) {
        const path = new URL(request.url).pathname;
        if (path.startsWith(PREFIX)) return seasonRequest(request, env);
        if (request.method === 'GET') {
            const page = appStorePage(path);
            if (page) return page;
        }
        return legacy.fetch(request, env, ctx);
    }
};
