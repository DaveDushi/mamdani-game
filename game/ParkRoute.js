import { courseSpeed } from './Course.js';
import { APPROACH_SECONDS } from './RaceApproach.js';

// Seven complete street blocks from the river's far bank to the next tunnel.
export const PARK_LENGTH = 336;
export const PARK_FIRST = 945;
export const PARK_PERIOD = 3600;
export const parkStart = metres => PARK_FIRST + Math.max(0, Math.floor((metres - PARK_FIRST + 360) / PARK_PERIOD)) * PARK_PERIOD;
export const touchesPark = (from, to) => {
    const start = parkStart(to);
    return from < start + PARK_LENGTH && to >= start;
};

// Put both curb cuts between actual generated rows. On re-entry the next
// outside-lane action needs time for a second swipe as well as the action.
function opening(rows, min, max, speed, merging) {
    let best = null, margin = -Infinity;
    for (let i = 1; i < rows.length; i++) {
        const before = rows[i - 1], after = rows[i];
        if (before.distance > max) break;
        if (after.distance < min || before.encounter || after.encounter || (!merging && before.iceLane === 0) ||
            !before.lanes || !after.lanes) continue;
        const far = after.exitLane === 2 || after.gate && after.lanes[0] === 'gateBlock' && after.lanes[1] === 'gateBlock';
        const low = Math.max(min, before.distance + 3 + speed * (merging ? .18 : .32));
        const high = Math.min(max, after.distance - 3 - speed * (merging ? (far ? .67 : .48) : .22));
        if (high >= low && high - low > margin) {
            best = (low + high) / 2;
            margin = high - low;
        }
    }
    return best;
}

export function parkRoute(start, rows, mode, overtime, rivalAt = Infinity) {
    const speed = courseSpeed(start + PARK_LENGTH, mode) * (overtime ? 1.1 : 1);
    const entry = opening(rows, start + 22, start + 104, speed, false);
    const exit = opening(rows, start + 225, start + 311, speed, true);
    if (entry === null || exit === null || exit + speed * APPROACH_SECONDS >= rivalAt) return null;
    const turn = Math.min(35, speed * .48);
    const length = exit - entry - turn * 2;
    const count = Math.min(6, Math.floor(length / (speed * .68)));
    if (count < 2) return null;
    const variants = [[1, 2, 1, 0, 1, 2], [1, 0, 1, 2, 1, 0], [1, 2, 0, 1, 0, 2]];
    const line = variants[Math.floor(entry) % variants.length];
    const gates = Array.from({ length: count }, (_, i) => ({
        at: entry + turn + length * (i + .65) / count,
        lane: line[i], style: (i + Math.floor(exit)) % 3
    }));
    return { entry, exit, turn, gates };
}

export function pathWidth(route, at) {
    const t = Math.max(0, Math.min(1, (at - route.entry) / route.turn, (route.exit - at) / route.turn));
    return t * t * (3 - 2 * t);
}

// All three paths converge on the street's left lane at each curb cut.
export const bikeLaneX = (lane, width) => -3 + (-12 + (lane - 1) * 2.65) * width;

export function pathBend(route, at, width) {
    const along = (at - route.entry) / (route.exit - route.entry);
    return 1.55 * Math.sin(2 * Math.PI * along) * width;
}
