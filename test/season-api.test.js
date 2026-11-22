import { test } from 'node:test';
import assert from 'node:assert/strict';

// Register the same promise-based request bridge Capacitor exposes on iOS.
globalThis.CapacitorCustomPlatform = { name: 'ios' };
globalThis.Capacitor = {
    PluginHeaders: [{ name: 'CapacitorHttp', methods: [{ name: 'request', rtype: 'promise' }] }],
    nativePromise: async () => { throw new Error('Unexpected native request'); }
};
const { Capacitor } = await import('@capacitor/core');
const { ApiClient } = await import('../game/ApiClient.js');

const origin = 'https://score.test';
const publishedApi = 'https://api.mamdanirun.com';

function stubWeb(t, responses) {
    const requests = [];
    t.mock.method(Capacitor, 'isNativePlatform', () => false);
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({
            url, method: options.method, cache: options.cache, body: options.body && JSON.parse(options.body)
        });
        const response = responses.shift();
        if (response instanceof Error) throw response;
        if (response instanceof Response) return response;
        return Response.json(response);
    });
    return requests;
}

test('season reads request fresh data and distinguish an empty board from an unreachable service', async t => {
    const requests = stubWeb(t, [
        { ok: true, record: null }, { ok: true, record: 1050 }, { ok: true, record: '1050' },
        { entries: [] }, new Error('Offline')
    ]);
    const api = new ApiClient();
    assert.deepEqual(await api.getSeasonRecord(), { score: null });
    assert.deepEqual(await api.getSeasonRecord(), { score: 1050 });
    assert.equal(await api.getSeasonRecord(), null);
    assert.deepEqual(await api.getSeasonLeaderboard(), []);
    assert.equal(await api.getSeasonLeaderboard(), null);
    assert.deepEqual(requests.map(({ url }) => url), [
        publishedApi + '/seasons/2.3.1/record', publishedApi + '/seasons/2.3.1/record', publishedApi + '/seasons/2.3.1/record',
        publishedApi + '/seasons/2.3.1/leaderboard?limit=50', publishedApi + '/seasons/2.3.1/leaderboard?limit=50'
    ]);
    assert.ok(requests.every(request => request.method === 'GET' && request.cache === 'no-store'));
});

test('an explicit claim retry sends the same ticket and keeps the server decision', async t => {
    const requests = stubWeb(t, [
        new Error('Connection lost mid-request'),
        { ok: true, qualified: true, previousRecord: 1050, record: 1051 },
        { ok: true, qualified: false, previousRecord: 1051, record: 1051 }
    ]);
    const api = new ApiClient(origin);
    const claim = { key: 'key-1', ticket: 'ticket-1', score: 1051, mode: 'day' };
    assert.equal(await api.claimSeasonRecord(claim), null);
    assert.equal(requests.length, 1);
    assert.deepEqual(await api.claimSeasonRecord(claim), {
        qualified: true, previousRecord: 1050, record: { score: 1051 }
    });
    assert.deepEqual(await api.claimSeasonRecord({ ...claim, ticket: 'ticket-2' }), {
        qualified: false, previousRecord: 1051, record: { score: 1051 }
    });
    assert.deepEqual(requests.slice(0, 2), Array(2).fill({
        url: origin + '/seasons/2.3.1/record/claim', method: 'POST', cache: undefined, body: claim
    }));
});

test('every web write carries the private key to the season routes', async t => {
    const requests = stubWeb(t, [
        { ok: true, ticket: 'ticket-1' }, { ok: true, rank: 1, bestScore: 1051 }, { ok: true }, { ok: true },
        { entries: [{ score: 7000, you: true }] }, { ok: true }
    ]);
    const api = new ApiClient(origin);
    assert.deepEqual(await api.startRun({ key: 'key-1', mode: 'night' }), { ticket: 'ticket-1' });
    assert.deepEqual(await api.submitSeasonScore({ key: 'key-1', ticket: 'ticket-1', score: 1051, mode: 'night' }), {
        ok: true, rank: 1, bestScore: 1051
    });
    assert.deepEqual(await api.register('key-1', 'Runner', '', true), { ok: true });
    assert.deepEqual(await api.sendFeedback('key-1', 'Feedback example'), { ok: true });
    assert.deepEqual(await api.getSeasonLeaderboard(10, 'key-1'), [{ score: 7000, you: true }]);
    assert.equal((await api.deleteSeasonData('key-1')).ok, true);
    assert.deepEqual(requests.map(({ url, body }) => [url, body]), [
        [origin + '/seasons/2.3.1/run', { key: 'key-1', mode: 'night' }],
        [origin + '/seasons/2.3.1/score', { key: 'key-1', ticket: 'ticket-1', score: 1051, mode: 'night' }],
        [origin + '/seasons/2.3.1/profile', { key: 'key-1', name: 'Runner', social: '', isPwa: true }],
        [origin + '/seasons/2.3.1/feedback', { key: 'key-1', message: 'Feedback example' }],
        [origin + '/seasons/2.3.1/leaderboard', { key: 'key-1', limit: 10 }],
        [origin + '/seasons/2.3.1/delete', { key: 'key-1' }]
    ]);
});

test('a lost ticket request is retried while the run wants it and a refusal is final', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const lost = Array.from({ length: 7 }, () => new Error('Offline'));
    const requests = stubWeb(t, [
        ...lost.slice(0, 3), { ok: true, ticket: 'ticket-1' },
        ...lost,
        new Response('{}', { status: 410 }),
        lost[0]
    ]);
    const api = new ApiClient(origin);
    const start = async wanted => {
        let result;
        const run = api.startRun({ key: 'key-1', mode: 'day', wanted }).then(value => { result = value; });
        for (let i = 0; i < 8; i++) {
            await new Promise(setImmediate);
            t.mock.timers.tick(8000);
        }
        await run;
        return result;
    };
    assert.deepEqual(await start(), { ticket: 'ticket-1' });
    assert.equal(requests.length, 4);
    assert.equal(await start(), null);
    assert.equal(requests.length, 11);
    assert.equal(await start(), null);
    assert.equal(requests.length, 12);
    assert.equal(await start(() => false), null);
    assert.equal(requests.length, 13);
});

test('a refused score is told apart from an unreachable service', async t => {
    stubWeb(t, [422, 503, 429].map(status => new Response('{}', { status })).concat(new Error('Offline')));
    const api = new ApiClient(origin);
    const run = { key: 'key-1', ticket: 'ticket-1', score: 10, mode: 'day' };
    assert.deepEqual(await api.submitSeasonScore(run), { ok: false, rejected: true });
    for (let i = 0; i < 3; i++) assert.deepEqual(await api.submitSeasonScore(run), { ok: false });
});

test('Capacitor reads the shared record and sends private profile operations over iPhone routes', async t => {
    const calls = t.mock.method(Capacitor, 'nativePromise', async (_plugin, _method, options) => ({
        status: 200,
        data: options.method === 'GET'
            ? { ok: true, record: null }
            : { ok: true, qualified: true, previousRecord: null, record: 1051 }
    }));
    const api = new ApiClient();
    const claim = { key: 'key-1', ticket: 'ticket-1', score: 1051, mode: 'night' };
    assert.deepEqual(await api.getSeasonRecord(), { score: null });
    assert.deepEqual(await api.claimSeasonRecord(claim), {
        qualified: true, previousRecord: null, record: { score: 1051 }
    });
    assert.equal((await api.deleteSeasonData(claim.key)).ok, true);
    assert.equal((await api.register(claim.key, 'Night Owl', '@not-sent')).ok, true);
    assert.deepEqual(calls.mock.calls.map(call => call.arguments.slice(0, 2)), [
        ['CapacitorHttp', 'request'], ['CapacitorHttp', 'request'], ['CapacitorHttp', 'request'], ['CapacitorHttp', 'request']
    ]);
    assert.deepEqual(calls.mock.calls.map(({ arguments: [, , options] }) => [
        options.url, options.method, options.data, options.responseType
    ]), [
        [publishedApi + '/seasons/2.3.1/record', 'GET', undefined, 'json'],
        [publishedApi + '/seasons/2.3.1/ios/record/claim', 'POST',
            { key: 'key-1', ticket: 'ticket-1', score: 1051, mode: 'night' }, 'json'],
        [publishedApi + '/seasons/2.3.1/ios/delete', 'POST', { key: 'key-1' }, 'json'],
        [publishedApi + '/seasons/2.3.1/ios/profile', 'POST', { key: 'key-1', name: 'Night Owl' }, 'json']
    ]);
});

test('iPhone reads the same named global leaderboard as the web game', async t => {
    const entries = [{ name: 'Runner Ace', score: 1250 }, { name: 'iPhone runner', score: 1200 }];
    const calls = t.mock.method(Capacitor, 'nativePromise', async (_plugin, _method, { url }) => ({
        status: 200,
        data: { entries: url.includes('/ios/') ? entries.map(({ score }) => ({ score })) : entries }
    }));
    assert.deepEqual(await new ApiClient().getSeasonLeaderboard(), entries);
    assert.equal(calls.mock.calls[0].arguments[2].url, publishedApi + '/seasons/2.3.1/leaderboard?limit=50');
});
