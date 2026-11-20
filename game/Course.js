const EXIT = 'exit';
const openings = [
    [
        ['protest', null, EXIT],
        ['halal', EXIT, 'taxi'],
        [EXIT, 'scaffold', 'protest'],
        ['taxi', 'protest', EXIT]
    ],
    [
        [EXIT, null, 'scaffold'],
        ['taxi', 'protest', EXIT],
        ['halal', EXIT, 'scaffold'],
        [EXIT, 'taxi', 'protest']
    ],
    [
        ['halal', null, EXIT],
        [EXIT, 'protest', 'scaffold'],
        ['taxi', EXIT, 'protest'],
        ['protest', 'taxi', EXIT]
    ]
];

const stages = [
    {
        gap: 29,
        gates: [
            ['taxi', EXIT, 'scaffold'],
            [EXIT, 'halal', 'protest'],
            ['protest', 'taxi', EXIT]
        ],
        sequences: [
            [[EXIT, 'taxi', null], ['scaffold', EXIT, 'protest']],
            [['taxi', null, EXIT], [EXIT, 'protest', 'scaffold']],
            [['taxi', EXIT, 'protest'], [null, 'scaffold', EXIT]]
        ]
    },
    {
        gap: 30,
        gates: [
            ['scaffold', 'taxi', EXIT],
            ['protest', EXIT, 'halal'],
            [EXIT, 'scaffold', 'alcohol']
        ],
        sequences: [
            [['protest', EXIT, 'halal'], [EXIT, 'taxi', 'alcohol'], ['scaffold', 'protest', EXIT]],
            [['taxi', 'scaffold', EXIT], [EXIT, 'protest', 'halal']],
            [[EXIT, 'scaffold', 'taxi'], [null, 'halal', EXIT], ['taxi', EXIT, 'protest']]
        ]
    },
    {
        gap: 31,
        gates: [
            ['halal', EXIT, 'scaffold'],
            [EXIT, 'taxi', 'halal'],
            ['alcohol', 'taxi', EXIT],
            ['scaffold', 'protest', EXIT]
        ],
        sequences: [
            [['halal', EXIT, 'protest'], [EXIT, 'protest', 'taxi'], ['protest', 'scaffold', EXIT]],
            [['taxi', 'protest', EXIT], ['scaffold', EXIT, 'halal'], [EXIT, 'taxi', 'alcohol']],
            [[EXIT, 'scaffold', 'protest'], ['protest', 'taxi', EXIT], ['halal', EXIT, 'taxi']],
            [['alcohol', EXIT, 'scaffold'], ['taxi', 'halal', EXIT], [EXIT, 'protest', 'taxi']]
        ]
    },
    {
        gap: 31,
        gates: [
            [EXIT, 'protest', 'taxi'],
            [EXIT, 'scaffold', 'protest'],
            [EXIT, 'halal', 'taxi'],
            ['alcohol', 'taxi', EXIT]
        ],
        sequences: [
            [[EXIT, 'scaffold', 'protest'], ['taxi', 'protest', EXIT], ['halal', EXIT, 'taxi']],
            [['protest', 'taxi', EXIT], [EXIT, 'halal', 'scaffold'], ['taxi', EXIT, 'protest'], [EXIT, 'protest', 'halal']],
            [[EXIT, 'taxi', 'halal'], ['protest', 'scaffold', EXIT], [EXIT, 'protest', 'taxi']],
            [['scaffold', EXIT, 'protest'], [EXIT, 'taxi', 'alcohol'], ['halal', 'protest', EXIT], ['protest', EXIT, 'taxi']],
            [['halal', 'protest', EXIT], [EXIT, 'scaffold', 'taxi'], ['protest', EXIT, 'scaffold']]
        ]
    }
];

const protections = ['rainbow', 'kafiyeh', 'covidMask'];
const stuntCards = [
    [
        [null, 'jump', null, 'slide', null, 'choice'],
        ['choice', null, 'rail', null, 'jump', null]
    ],
    [
        ['jump', 'slide', null, 'choice', null],
        ['slide', 'choice', null, 'rail', 'slide', null],
        [null, 'choice', 'slide', 'rail', null]
    ],
    [
        ['jump', 'slide', 'choice', null, 'rail'],
        ['slide', 'rail', null, 'choice', 'jump'],
        ['choice', 'slide', 'jump', 'slide', null],
        [null, 'jump', 'choice', 'slide', 'rail']
    ]
];

export function courseSpeed(distance, mode = 'day') {
    if (mode === 'night') return Math.min(62, Math.sqrt(29 ** 2 + 0.84 * distance));
    const opening = Math.min(distance, 650);
    return Math.min(58, Math.sqrt(17.5 ** 2 + 1.44 * opening + 0.84 * (distance - opening)));
}

function rowGap(distance, minimum, mode) {
    // Leave room to land, change lanes and time another action at full speed.
    return Math.max(minimum, Math.ceil(courseSpeed(distance + 90, mode) * 0.97));
}

function choose(cards, previous, random) {
    const choices = cards.filter(card => card !== previous);
    return choices[Math.floor(random() * choices.length)];
}

function trafficRow(distance, slots, mirror, random, cueStep = 4) {
    const lanes = mirror ? [...slots].reverse() : slots;
    return {
        distance,
        lanes: lanes.map(key => (key === 'protest' ? `protest${Math.floor(random() * 3)}` : key)),
        exitLane: lanes.indexOf(EXIT),
        cueStep
    };
}

export function* streetCourse(random = Math.random, mode = 'day') {
    const night = mode === 'night';
    let distance = 0;
    let lastExit;
    if (!night) {
        const opening = choose(openings, null, random);
        const mirrorOpening = random() < 0.5;
        distance = 28;
        for (const [i, slots] of opening.entries()) {
            if (i > 0) distance += 32;
            const row = trafficRow(distance, slots, mirrorOpening, random);
            lastExit = row.exitLane;
            yield row;
        }
    }

    let card = night
        ? [null, null, 'jump', 'slide', null, 'choice', 'rail']
        : ['jump', null, 'slide', null, 'choice', 'rail'];
    let cardIndex = 0;
    let lastStuntLane;
    let tutorialGates = 3;
    function nextRow(slots, mirror, cueStep) {
        if (cardIndex === card.length) {
            const difficulty = distance + (night ? 260 : 0);
            card = choose(stuntCards[difficulty < 510 ? 0 : difficulty < 1150 ? 1 : 2], card, random);
            cardIndex = 0;
        }
        const gate = card[cardIndex++];
        if (!gate) {
            const row = trafficRow(distance, slots, mirror, random, cueStep);
            lastExit = row.exitLane;
            return row;
        }
        const lane = lastStuntLane === undefined ? lastExit : (lastStuntLane + 1 + Math.floor(random() * 2)) % 3;
        lastStuntLane = lane;
        const lanes = ['gateBlock', 'gateBlock', 'gateBlock'];
        lanes[lane] = gate === 'choice' ? 'jumpGate' : gate + 'Gate';
        if (gate === 'choice') lanes[(lane + 1 + Math.floor(random() * 2)) % 3] = 'slideGate';
        const tutorial = tutorialGates > 0;
        if (tutorial) tutorialGates--;
        return { distance, lanes, gate, tutorial, cueStep };
    }

    let previousGate;
    let previousSequence;
    let protectionIndex = Math.floor(random() * protections.length);
    let nextProtection = night ? 820 : 300;
    const protectionSpacing = night ? 1650 : 1200;
    for (let cycle = 0; ; cycle++) {
        const stage = stages[night || distance >= 950 ? 3 : distance < 220 ? 0 : distance < 610 ? 1 : 2];
        const speed = courseSpeed(distance, mode);
        const cueStep = Math.max(4, Math.round(speed * 0.14));
        const gap = rowGap(distance, stage.gap, mode) + Math.floor(random() * 4);
        const pickupDistance = distance + Math.max(21, Math.ceil(speed * 0.42));
        const protectionDue = pickupDistance >= nextProtection;
        const recovery = protectionDue || cycle % 3 === 0;
        if (protectionDue) {
            yield {
                distance: pickupDistance,
                pickupLane: Math.floor(random() * 3),
                pickup: protections[protectionIndex++ % protections.length]
            };
            nextProtection = pickupDistance + protectionSpacing;
        }
        distance += night && cycle === 0 ? 42 : gap + (recovery ? Math.max(19, Math.ceil(speed * 0.44)) : 0);

        previousGate = choose(stage.gates, previousGate, random);
        yield nextRow(previousGate, random() < 0.5, cueStep);

        previousSequence = choose(stage.sequences, previousSequence, random);
        const mirror = random() < 0.5;
        for (const slots of previousSequence) {
            distance += rowGap(distance, stage.gap, mode);
            yield nextRow(slots, mirror, cueStep);
        }
    }
}
