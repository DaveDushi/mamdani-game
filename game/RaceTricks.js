// What each rival does to a fast-tapping runner. A window covers part of the race clock:
// 'stop' trips a tap, 'gold' makes taps worth more, 'side' wants one pad and 'feet' wants left and right in turn.
export const WARNING = .55;

function random(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const scripts = {
    junior: () => [],

    ivanka(end, draw) {
        const early = end * (.2 + .07 * draw()), late = end * (.58 + .08 * draw());
        return [
            { from: early, to: early + 1.6, kind: 'gold' },
            { from: late, to: late + 1.9, kind: 'gold' }
        ];
    },

    // Always four red lights of about the same length, so no draw is a lost race.
    eric(end, draw) {
        const first = 1.7, share = (end - 1.6 - first) / 4;
        return Array.from({ length: 4 }, (_, i) => {
            const from = first + share * (i + .45 * draw());
            return { from, to: from + .64 + .06 * draw(), kind: 'stop' };
        });
    },

    tiffany(end, draw) {
        const windows = [];
        let side = 0, t = 0, hold = 1.7;
        while (t < end) {
            windows.push({ from: t, to: t + hold, kind: 'side', side });
            t += hold;
            hold = Math.max(1.05, hold - .08) + .12 * draw();
            side = draw() < .5 ? (side === -1 ? 0 : -1) : side === 1 ? 0 : 1;
        }
        return windows;
    },

    barron: end => [{ from: 0, to: end, kind: 'feet' }],

    donald(end, draw) {
        const stop = 1.6 + .5 * draw();
        return [
            { from: stop, to: stop + .75, kind: 'stop' },
            { from: end * .30, to: end * .30 + .7, kind: 'stop' },
            { from: end * .43, to: end * .70, kind: 'feet' },
            { from: end * .78, to: end, kind: 'gold' }
        ];
    }
};

export function raceTricks(rival, seed = 1) {
    return scripts[rival.id](rival.finish, random(seed * 7919 + rival.index * 104729 + 17));
}
