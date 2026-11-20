import legacy from './legacy.js';
import { PREFIX, seasonRequest } from './season.js';

export default {
    ...legacy,
    fetch(request, env, ctx) {
        if (new URL(request.url).pathname.startsWith(PREFIX)) return seasonRequest(request, env);
        return legacy.fetch(request, env, ctx);
    }
};
