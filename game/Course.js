import { createCivicSchedule } from './CivicSchedule.js';

const EXIT = 'exit';
const openings = [
    [
        ['protest', null, EXIT], ['taxi', 'protest', EXIT],
        ['halal', EXIT, 'scaffold'], [EXIT, 'taxi', 'protest']
    ],
    [
        [EXIT, null, 'scaffold'], [EXIT, 'taxi', 'protest'],
        ['halal', EXIT, 'scaffold'], ['taxi', 'protest', EXIT]
    ],
    [
        ['halal', null, EXIT], ['scaffold', 'taxi', EXIT],
        ['taxi', EXIT, 'protest'], [EXIT, 'protest', 'scaffold']
    ],
    [
        [EXIT, null, 'taxi'], ['protest', EXIT, 'halal'],
        ['scaffold', 'taxi', EXIT], ['halal', 'protest', EXIT]
    ],
    [
        ['protest', null, EXIT], ['taxi', EXIT, 'scaffold'],
        [EXIT, 'halal', 'taxi'], [EXIT, 'scaffold', 'protest']
    ]
];

const protections = ['rainbow', 'kafiyeh', 'covidMask'];
const streetTraffic = ['taxi', 'halal', 'scaffold', 'protest'];
const trafficPairs = [
    ['taxi', 'scaffold'], ['protest', 'halal'], ['taxi', 'protest'],
    ['halal', 'taxi'], ['scaffold', 'protest'], ['scaffold', 'halal']
];
const lanes = [0, 1, 2];
const stunts = ['jump', 'slide', 'rail', 'choice'];
const afterJump = ['jump', 'slide', 'slide', 'slide', 'rail', 'choice'];
const marathonLanding = ['slide', 'slide', 'slide', 'slide', 'slide', 'rail'];
const movingEncounters = ['delivery-dolly', 'signal-boom'];
const linkedCrews = [
    ['delivery-dolly', 'signal-boom'],
    ['signal-boom', 'delivery-dolly'],
    ['signal-boom', 'signal-boom']
];
const firstEncounterAt = { day: [290, 430], night: [215, 350] };
const lateTurnPatterns = [.42, .64, .88];

// Beats specify a gate, lane-change probability (0 holds, 1 turns) and timing offset in seconds.
const patterns = [
    { at: 0, beats: [['jump', 0, .08], ['slide', 1, -.09]] },
    { at: 0, beats: [['slide', 1, .02], ['rail', 1, -.10]] },
    { at: 0, beats: [['rail', 0, .04], ['jump', 1, -.12]] },
    { at: 0, beats: [['choice', 1, .08], ['slide', 0, -.14]] },
    { at: 900, beats: [['slide', 0, .10], ['jump', 0, -.09], ['slide', 1, -.15]] },
    { at: 900, beats: [['rail', 1, .10], ['slide', 1, -.10], ['choice', 0, -.08]] },
    { at: 900, beats: [['jump', 1, .08], ['slide', 1, -.14], ['rail', 0, -.05]] },
    { at: 2500, beats: [['choice', 0, .08], ['slide', 1, -.13], ['jump', 1, -.10], ['slide', 0, -.16]] },
    { at: 2500, beats: [['slide', 1, .08], ['rail', 0, -.12], ['slide', 1, -.15], ['choice', 1, -.10]] }
];

const tiers = [
    { at: 0,     seconds: 1.36, move: .38, minimum: 1, maximum: 2 },
    { at: 350,   seconds: 1.05, move: .55, minimum: 2, maximum: 3 },
    { at: 1400,  seconds: .89, move: .63, minimum: 4, maximum: 6 },
    { at: 3500,  seconds: .82, move: .74, minimum: 5, maximum: 8 },
    { at: 8500,  seconds: .73, move: .84, minimum: 6, maximum: 10 },
    { at: 22000, seconds: .66, move: .91, minimum: 8, maximum: 13 },
    { at: 50000, seconds: .60, move: .96, minimum: 10, maximum: 16 }
];

const longRun = [
    [5000, 62, 65], [10000, 69, 72], [30000, 78, 81], [60000, 82, 85]
];

function openingSpeed(distance, night) {
    if (night) return Math.sqrt(29 ** 2 + 0.84 * distance);
    const opening = Math.min(distance, 650);
    return Math.sqrt(17.5 ** 2 + 1.44 * opening + 0.84 * (distance - opening));
}

export function courseSpeed(distance, mode = 'day') {
    const night = mode === 'night';
    if (distance <= 3000) return openingSpeed(distance, night);
    let from = 3000;
    let speed = openingSpeed(from, night);
    for (const [to, daySpeed, nightSpeed] of longRun) {
        const next = night ? nightSpeed : daySpeed;
        if (distance <= to) return speed + (next - speed) * ((distance - from) / (to - from));
        from = to;
        speed = next;
    }
    return speed;
}

function pick(items, random) {
    return items[Math.floor(random() * items.length)];
}

function nextLane(previousLane, reachable, move, random) {
    if (reachable.length === 1) return reachable[0];
    if (random() < move) return pick(reachable.filter(lane => lane !== previousLane), random);
    return previousLane;
}

function canJump(gate) {
    return gate === 'jump' || gate === 'rail' || gate === 'choice';
}

function streetRow(distance, slots, cueStep, random) {
    return {
        distance, cueStep, exitLane: slots.indexOf(EXIT),
        lanes: slots.map(key => key === 'protest' ? 'protest' + Math.floor(random() * 3) : key)
    };
}

export function* streetCourse(random = Math.random, mode = 'day', isOvertime = () => false) {
    const night = mode === 'night';
    const selectCivic = createCivicSchedule(random, night ? 425 : 500);
    const introductions = night ? firstEncounterAt.night : firstEncounterAt.day;
    let distance = 0;
    let previous = [1];
    let previousJump = false;
    let tutorialsLeft = 3;
    if (!night) {
        const opening = pick(openings, random);
        const mirror = random() < 0.5;
        for (const slots of opening) {
            distance = distance === 0 ? 28 : distance + 32;
            const row = streetRow(distance, mirror ? [...slots].reverse() : slots, 4, random);
            previous = [row.exitLane];
            yield row;
        }
    }

    function advance(seconds, jump) {
        // Leave time to land and take off again from either option in a fork.
        if (previousJump && jump) seconds = Math.max(seconds, .99);
        previousJump = jump;
        const speed = courseSpeed(distance + 100, mode);
        distance += Math.ceil(seconds * speed);
        return Math.max(4, Math.round(speed * .14));
    }

    function reachableLanes() {
        return lanes.filter(lane => previous.every(last => Math.abs(last - lane) <= 1));
    }

    function row(gate, seconds, move, bonusRoute = false, bottle = false) {
        const reachable = reachableLanes();
        const lane = nextLane(previous[0], reachable, move, random);
        previous = [lane];
        if (!gate) {
            const slots = bottle || random() < .36 ? ['alcohol', pick(streetTraffic, random)] : [...pick(trafficPairs, random)];
            if (random() < 0.5) slots.reverse();
            slots.splice(lane, 0, EXIT);
            const sideLanes = reachable.filter(other => Math.abs(lane - other) === 1);
            const bonusLane = bonusRoute && sideLanes.length ? pick(sideLanes, random) : undefined;
            if (bonusLane !== undefined) {
                if (slots[bonusLane] === 'alcohol') {
                    const blockedLane = lanes.find(other => other !== lane && other !== bonusLane);
                    slots[blockedLane] = 'alcohol';
                }
                slots[bonusLane] = pick(['taxi', 'halal', 'scaffold'], random);
                previous.push(bonusLane);
            }
            const cueStep = advance(seconds, bonusLane !== undefined && slots[bonusLane] === 'taxi');
            const event = streetRow(distance, slots, cueStep, random);
            if (bonusLane !== undefined) event.bonusLane = bonusLane;
            return event;
        }
        const cueStep = advance(seconds, canJump(gate));
        const slots = ['gateBlock', 'gateBlock', 'gateBlock'];
        slots[lane] = gate === 'choice' ? 'jumpGate' : gate + 'Gate';
        if (gate === 'choice') {
            const other = pick(reachable.filter(other => Math.abs(other - lane) === 1), random);
            slots[other] = 'slideGate';
            previous.push(other);
        }
        const tutorial = tutorialsLeft > 0;
        if (tutorial) tutorialsLeft--;
        return { distance, lanes: slots, gate, tutorial, cueStep };
    }

    function movingRow(id, seconds, move, overtime, fork = false) {
        const reachable = reachableLanes();
        const exitLane = nextLane(previous[0], reachable, move, random);
        const dolly = id === 'delivery-dolly';
        const otherLane = pick((dolly ? lanes : reachable).filter(lane => Math.abs(lane - exitLane) === 1), random);
        const blockedLane = lanes.find(lane => lane !== exitLane && lane !== otherLane);
        const position = !dolly && random() < .5 ? 'low' : 'high';
        const cueStep = advance(seconds, !dolly && (position === 'low' || fork));
        const approachSpeed = courseSpeed(distance, mode) * (overtime ? 1.1 : 1);
        const slots = [null, null, null];
        slots[otherLane] = dolly ? 'deliveryDolly' : 'signalBoom';
        if (fork) slots[exitLane] = position === 'low' ? 'slideGate' : 'jumpGate';
        slots[blockedLane] = pick(['taxi', 'halal', 'scaffold', 'alcohol'], random);
        previous = dolly ? [exitLane] : [exitLane, otherLane];
        const encounter = dolly
            ? { id, fromLane: exitLane, toLane: otherLane, approachSpeed }
            : { id, lane: otherLane, position, approachSpeed };
        const event = { distance, lanes: slots, exitLane, cueStep, encounter };
        if (!dolly) event.actionLane = otherLane;
        return event;
    }

    function iceRow(seconds) {
        const reachable = reachableLanes();
        const iceLane = pick(reachable, random);
        const exitLane = pick(reachable.filter(lane => lane !== iceLane), random);
        const cueStep = advance(seconds, false);
        const slots = [null, null, null];
        slots[iceLane] = 'rentIce';
        previous = [1, 0, 2];
        return { distance, lanes: slots, iceLane, exitLane, cueStep };
    }

    function carriageRow(seconds, move, overtime) {
        const reachable = reachableLanes();
        const exitLane = nextLane(previous[0], reachable, move, random);
        const lane = pick(lanes.filter(lane => Math.abs(lane - exitLane) === 1), random);
        const cueStep = advance(seconds, false);
        const slots = [null, null, null];
        slots[lane] = 'horseCarriage';
        previous = [exitLane, ...lanes.filter(other => other !== lane && other !== exitLane)];
        const approachSpeed = courseSpeed(distance, mode) * (overtime ? 1.1 : 1);
        return { distance, lanes: slots, exitLane, cueStep, encounter: { id: 'horse-carriage', lane, approachSpeed } };
    }

    function protestRow(beat, seconds, move, overtime) {
        const event = row(beat === 'tape' ? 'slide' : 'jump', seconds, move);
        const approachSpeed = courseSpeed(distance, mode) * (overtime ? 1.1 : 1);
        event.encounter = { id: 'protest-line', beat, approachSpeed };
        return event;
    }

    if (night) {
        yield row(null, 42 / courseSpeed(100, mode), 0.5);
        yield row(null, 1.05, 0.6);
    }
    const lessonGap = night ? 1.12 : 1.38;
    yield row('jump', lessonGap, .22);
    yield row(null, lessonGap, .50, false, true);
    yield row('slide', lessonGap, .22);
    yield row(null, lessonGap + random() * .22, .60);
    yield row('choice', lessonGap, .34);
    yield row('rail', lessonGap, .34);

    let protectionIndex = Math.floor(random() * protections.length);
    let wearablesUntilBus = 1;
    let firstPickup = true;
    let nextPickup = night ? 820 : 300;
    let tierIndex = 0;
    let introduced = 0;
    let nextIce = 2900;
    let seenProtest = false;
    let lastStunt;
    let repeated = 0;
    let recentPatterns = [];
    while (true) {
        const effort = night ? distance * 1.2 + 200 : distance;
        while (tierIndex + 1 < tiers.length && effort >= tiers[tierIndex + 1].at) tierIndex++;
        // Finish the set already in view before adding Overtime pressure.
        const overtime = isOvertime();
        const tier = tiers[Math.min(tierIndex + (overtime ? 1 : 0), tiers.length - 1)];
        const move = effort >= 8500 ? pick(lateTurnPatterns, random) : tier.move;
        const speed = courseSpeed(distance + 100, mode);
        const pickupDistance = distance + Math.ceil(speed * 0.65);
        if (pickupDistance >= nextPickup) {
            const bus = wearablesUntilBus === 0;
            const pickup = bus ? 'fastFreeBus' : protections[protectionIndex++ % protections.length];
            yield { distance: pickupDistance, pickupLane: previous[0], pickup };
            wearablesUntilBus = bus ? (random() < .6 ? 1 : 2) : wearablesUntilBus - 1;
            const spacing = firstPickup ? (night ? 850 : 650)
                : Math.max(night ? 1650 : 1200, Math.ceil(speed * (night ? 40 : 35)));
            nextPickup = pickupDistance + spacing;
            firstPickup = false;
        }
        const breakTime = Math.max(1.06, tier.seconds + .22) + random() * .52;
        const taught = introduced === movingEncounters.length;
        const ice = taught && distance >= nextIce;
        const civic = taught && !ice ? selectCivic(distance) : null;
        const carriage = civic === 'horse-carriage';
        if (ice) {
            yield iceRow(Math.max(1.65, breakTime));
            nextIce = distance + 4500 + Math.round(random() * 2500);
        } else if (carriage) {
            yield carriageRow(Math.max(1.68, breakTime), move, overtime);
        } else {
            yield row(null, breakTime, move, effort >= 450 && !civic && random() < .55);
        }
        if (civic === 'protest-line') {
            yield protestRow('tape', 1.18, move, overtime);
            yield protestRow('placard', 1.30, seenProtest ? move : 0, overtime);
            seenProtest = true;
            continue;
        }

        if (!taught && distance >= introductions[introduced]) {
            yield movingRow(movingEncounters[introduced++], 1.65, move, overtime);
            continue;
        }

        const length = tier.minimum + Math.floor(random() * (tier.maximum - tier.minimum + 1));
        const linkChance = effort >= 22000 ? .82 : taught && distance >= 450 ? .54 : 0;
        const firstLink = ice || carriage ? 1 : 0;
        const linked = length > firstLink && random() < linkChance;
        const crews = linked && distance >= 30000 && random() < .74 ? pick(linkedCrews, random) : null;
        const separation = crews ? 2 + Math.floor(random() * 2) : 0;
        const linkedAt = linked ? firstLink + Math.floor(random() * (length - firstLink - separation)) : -1;
        // Long blocks can fit two different sequences, with a loose beat between them.
        const planned = Array(length);
        const span = length >= 8 ? Math.floor((length - 1) / 2) : length;
        for (let start = 0; start + span <= length; start += span + 1) {
            const available = patterns.filter(p => effort >= p.at && p.beats.length <= span && !recentPatterns.includes(p));
            if (!available.length) continue;
            const pattern = pick(available, random);
            const offset = start + Math.floor(random() * (span - pattern.beats.length + 1));
            pattern.beats.forEach((beat, index) => { planned[offset + index] = beat; });
            recentPatterns = [...recentPatterns.slice(-2), pattern];
        }
        for (let i = 0; i < length; i++) {
            const first = i === linkedAt;
            const second = crews && i === linkedAt + separation;
            if (first || second) {
                const id = crews ? crews[first ? 0 : 1] : pick(movingEncounters, random);
                const fork = id === 'signal-boom' && distance >= 15000 && random() < .65;
                yield movingRow(id, 1.05 + random() * .35, move, overtime, fork);
            }
            // More low runs at marathon pace keep the beat moving while the player lands.
            const options = previousJump && effort >= 50000 ? marathonLanding :
                previousJump && effort >= 3500 ? afterJump : stunts;
            const mayFork = reachableLanes().length > 1;
            const [plannedGate, turn = move, timing] = planned[i] ?? [];
            const allowed = options.filter(type => (repeated < 2 || type !== lastStunt) &&
                (mayFork || type !== 'choice'));
            const gate = allowed.includes(plannedGate) ? plannedGate : pick(allowed, random);
            repeated = gate === lastStunt ? repeated + 1 : 1;
            lastStunt = gate;
            const beat = random();
            const gap = timing ?? (beat < .36 ? -.06 - random() * .08 : beat < .86 ? -.04 + random() * .11 : .14 + random() * .18);
            const recovery = i === 0 && ice ? 1.60 : i === 0 && carriage ? 1.18 : distance < 450 ? 1.27 : .60;
            const seconds = first || second ? (crews ? 1.05 : Math.max(.86, tier.seconds + .15)) + random() * .25 :
                Math.max(recovery, tier.seconds + gap);
            const event = row(gate, seconds, turn);
            if (plannedGate && distance >= 450 && (gate === 'jump' || gate === 'slide')) {
                event.streetProp = gate === 'jump' ? 'taxi' : pick(['halal', 'scaffold'], random);
            }
            yield event;
        }
    }
}
