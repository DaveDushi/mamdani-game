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
    ]
];

const protections = ['rainbow', 'kafiyeh', 'covidMask'];
const trafficPairs = [
    ['taxi', 'scaffold'], ['protest', 'halal'], ['taxi', 'protest'],
    ['halal', 'taxi'], ['scaffold', 'protest'], ['taxi', 'alcohol']
];
const lanes = [0, 1, 2];
const singles = [['jump'], ['slide'], ['rail'], ['choice']];
const pairs = [
    ['jump', 'slide'], ['slide', 'jump'], ['rail', 'slide'], ['jump', 'choice']
];
const combinations = [
    ['jump', 'slide', 'rail'], ['slide', 'choice', 'jump'], ['rail', 'jump', 'slide'],
    ['jump', 'jump'], ['slide', 'rail'], ['slide', 'jump', 'slide']
];

// Each set ends in a roomy street row. Longer sets demand sustained play before that reset.
const tiers = [
    { at: 0,     seconds: 1.36, move: 0.25, count: 1, cards: singles },
    { at: 450,   seconds: 1.14, move: 0.48, count: 1, cards: pairs },
    { at: 1400,  seconds: 1.00, move: 0.63, count: 2, cards: combinations },
    { at: 3500,  seconds: 0.90, move: 0.74, count: 2, cards: combinations },
    { at: 8500,  seconds: 0.81, move: 0.84, count: 3, cards: combinations },
    { at: 22000, seconds: 0.73, move: 0.91, count: 4, cards: combinations },
    { at: 50000, seconds: 0.66, move: 0.96, count: 5, cards: combinations }
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
    let distance = 0;
    let previous = [1];
    let lastGate = null;
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

    function row(gate, seconds, move) {
        // A rail or fork can be jumped too. Leave time for a full jump and another
        // takeoff, even on the faster Overtime clock or a coarse input frame.
        if (canJump(lastGate) && canJump(gate)) seconds = Math.max(seconds, 0.99);
        const speed = courseSpeed(distance + 100, mode);
        distance += Math.ceil(seconds * speed);
        const cueStep = Math.max(4, Math.round(speed * 0.14));
        // From either fork exit the runner can reach any offered route in one swipe.
        const reachable = lanes.filter(lane => previous.every(last => Math.abs(last - lane) <= 1));
        const lane = nextLane(previous[0], reachable, move, random);
        previous = [lane];
        lastGate = gate;
        if (!gate) {
            const slots = [...pick(trafficPairs, random)];
            if (random() < 0.5) slots.reverse();
            slots.splice(lane, 0, EXIT);
            return streetRow(distance, slots, cueStep, random);
        }
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

    if (night) {
        yield row(null, 42 / courseSpeed(100, mode), 0.5);
        yield row(null, 1.05, 0.6);
    }
    for (const gate of ['jump', null, 'slide', null, 'choice', 'rail']) {
        yield row(gate, night ? 1.12 : 1.38, gate ? 0.22 : 0.5);
    }

    let protectionIndex = Math.floor(random() * protections.length);
    let nextProtection = night ? 820 : 300;
    let lastCard;
    let tierIndex = 0;
    while (true) {
        const effort = night ? distance * 1.2 + 200 : distance;
        while (tierIndex + 1 < tiers.length && effort >= tiers[tierIndex + 1].at) tierIndex++;
        // Finish the set already in view before adding Overtime pressure.
        const tier = tiers[Math.min(tierIndex + (isOvertime() ? 1 : 0), tiers.length - 1)];
        const speed = courseSpeed(distance + 100, mode);
        const pickupDistance = distance + Math.ceil(speed * 0.65);
        if (pickupDistance >= nextProtection) {
            // Recover in the lane just cleared. A wearable never calls for an extra lane change.
            const pickup = protections[protectionIndex++ % protections.length];
            yield { distance: pickupDistance, pickupLane: previous[0], pickup };
            nextProtection = pickupDistance + Math.max(night ? 1650 : 1200, Math.ceil(speed * (night ? 34 : 29)));
        }
        yield row(null, Math.max(1.50, tier.seconds + 0.28), tier.move);
        for (let i = 0; i < tier.count; i++) {
            lastCard = pick(tier.cards.filter(card => card !== lastCard), random);
            for (const gate of lastCard) {
                // Short changes of height alternate with longer takeoff and reading beats.
                const variation = gate === 'slide' ? -random() * 0.07 : random() * 0.09;
                yield row(gate, tier.seconds + variation, tier.move);
            }
        }
    }
}
