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

test('an explicit claim retry sends the same attempt ID and keeps the server decision', async t => {
    const requests = stubWeb(t, [
        new Error('Connection lost mid-request'),
        { ok: true, qualified: true, previousRecord: 1050, record: 1051 },
        { ok: true, qualified: false, previousRecord: 1051, record: 1051 }
    ]);
    const api = new ApiClient(origin);
    const claim = { playerId: 'player-1', attemptId: 'attempt-1', score: 1051, mode: 'day' };
    assert.equal(await api.claimSeasonRecord(claim), null);
    assert.equal(requests.length, 1);
    assert.deepEqual(await api.claimSeasonRecord(claim), {
        qualified: true, previousRecord: 1050, record: { score: 1051 }
    });
    assert.deepEqual(await api.claimSeasonRecord({ ...claim, attemptId: 'attempt-2' }), {
        qualified: false, previousRecord: 1051, record: { score: 1051 }
    });
    assert.deepEqual(requests.slice(0, 2), Array(2).fill({
        url: origin + '/seasons/2.3.1/record/claim', method: 'POST', cache: undefined, body: claim
    }));
});

test('season scores are isolated while profile and feedback posts use the established routes', async t => {
    const requests = stubWeb(t, [
        { ok: true, rank: 1, bestScore: 1051 }, { ok: true }, { ok: true }, { entries: [{ score: 7000 }] }
    ]);
    const api = new ApiClient(origin);
    assert.deepEqual(await api.submitSeasonScore({ playerId: 'player-1', score: 1051, mode: 'night' }), {
        ok: true, rank: 1, bestScore: 1051
    });
    assert.deepEqual(await api.register('player-1', 'Runner', '', true), { ok: true });
    assert.deepEqual(await api.sendFeedback('player-1', 'Feedback example'), { ok: true });
    assert.deepEqual(await api.getLeaderboard(10), [{ score: 7000 }]);
    assert.deepEqual(requests.map(({ url, body }) => [url, body]), [
        [origin + '/seasons/2.3.1/score', { playerId: 'player-1', score: 1051, mode: 'night' }],
        [origin + '/register', { playerId: 'player-1', name: 'Runner', social: '', isPwa: true }],
        [origin + '/feedback', { playerId: 'player-1', message: 'Feedback example' }],
        [origin + '/leaderboard?limit=10', undefined]
    ]);
});

test('Capacitor reads the shared record and sends private profile operations over iPhone routes', async t => {
    const calls = t.mock.method(Capacitor, 'nativePromise', async (_plugin, _method, options) => ({
        status: 200,
        data: options.method === 'GET'
            ? { ok: true, record: null }
            : { ok: true, qualified: true, previousRecord: null, record: 1051 }
    }));
    const api = new ApiClient();
    const claim = { playerId: 'player-1', attemptId: 'attempt-1', score: 1051, mode: 'night' };
    assert.deepEqual(await api.getSeasonRecord(), { score: null });
    assert.deepEqual(await api.claimSeasonRecord(claim), {
        qualified: true, previousRecord: null, record: { score: 1051 }
    });
    assert.equal((await api.deleteSeasonData(claim.playerId)).ok, true);
    assert.equal((await api.register(claim.playerId, 'Night Owl', '@not-sent')).ok, true);
    assert.deepEqual(calls.mock.calls.map(call => call.arguments.slice(0, 2)), [
        ['CapacitorHttp', 'request'], ['CapacitorHttp', 'request'], ['CapacitorHttp', 'request'], ['CapacitorHttp', 'request']
    ]);
    assert.deepEqual(calls.mock.calls.map(({ arguments: [, , options] }) => [
        options.url, options.method, options.data, options.responseType
    ]), [
        [publishedApi + '/seasons/2.3.1/record', 'GET', undefined, 'json'],
        [publishedApi + '/seasons/2.3.1/ios/record/claim', 'POST',
            { key: 'player-1', attemptId: 'attempt-1', score: 1051, mode: 'night' }, 'json'],
        [publishedApi + '/seasons/2.3.1/ios/delete', 'POST', { key: 'player-1' }, 'json'],
        [publishedApi + '/seasons/2.3.1/ios/profile', 'POST', { key: 'player-1', name: 'Night Owl' }, 'json']
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
