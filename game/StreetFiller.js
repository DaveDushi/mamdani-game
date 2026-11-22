import { PARK_LENGTH, parkStart } from './ParkRoute.js';
import { courseSpeed } from './Course.js';

// Parked and standing traffic between the rows. It only takes lanes that no route through the
// neighbouring rows can use, so the street fills up without asking for another move.
const CLEAR_BEFORE = .42;
// Nobody comes through a wall or a crowd, so traffic can stand right behind one.
const CLEAR_WALL = .16;
// A runner may have jumped or ducked the last thing in this lane and still be in the move.
const CLEAR_LANDING = .7;
const CLEAR_AFTER = .24;
const SPACING = .26;
const stunts = ['taxi', 'trashPile', 'halal', 'scaffold'];
const furniture = ['taxi', 'taxi', 'halal', 'scaffold', 'protest', 'trashPile'];

function draw(seed) {
    let t = (seed * 2654435761) >>> 0;
    return () => {
        t = (t + 0x6d2b79f5) >>> 0;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

function fillers(before, after, loose, mode) {
    // A horse gallops down the road behind its own row, and ice carries a runner sideways.
    if (!before.path || !after.path || before.encounter?.id === 'horse-carriage' || before.iceLane !== undefined) return [];
    const used = new Set([...before.path, ...after.path]);
    for (const { trail, pickupLane } of loose) for (const lane of trail ?? [pickupLane]) used.add(lane);
    // The bike path joins and leaves from the left lane.
    const start = parkStart(after.distance);
    if (after.distance > start - 40 && before.distance < start + PARK_LENGTH + 60) used.add(0);
    const random = draw(after.distance * 31 + before.distance);
    const speed = courseSpeed(before.distance, mode);
    const spots = new Map();
    for (const lane of [0, 1, 2]) {
        if (used.has(lane)) continue;
        const last = after.distance - speed * CLEAR_AFTER;
        const key = before.lanes[lane];
        const shut = key === 'gateBlock' || key?.startsWith('protest');
        const first = before.distance + speed * (shut ? CLEAR_WALL : stunts.includes(key) ? CLEAR_LANDING : CLEAR_BEFORE);
        if (last < first) continue;
        const count = Math.min(4, 1 + Math.floor((last - first) / Math.max(7, speed * SPACING)));
        for (let i = 0; i < count; i++) {
            if (random() > .9) continue;
            const distance = Math.round(first + (last - first) * (count === 1 ? .5 : i / (count - 1)));
            const piece = furniture[Math.floor(random() * furniture.length)];
            if (!spots.has(distance)) spots.set(distance, []);
            spots.get(distance).push({ lane, key: piece === 'protest' ? piece + Math.floor(random() * 3) : piece });
        }
    }
    return [...spots].map(([distance, fill]) => ({ distance, fill }));
}

export function* busyStreet(course, mode) {
    let before = null;
    let loose = [];
    for (const event of course) {
        if (!event.lanes) {
            loose.push(event);
            continue;
        }
        const between = before ? [...loose, ...fillers(before, event, loose, mode)] : loose;
        yield* between.sort((a, b) => a.distance - b.distance);
        yield event;
        before = event;
        loose = [];
    }
}
