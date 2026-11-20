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
    }
];

const protections = ['rainbow', 'kafiyeh', 'covidMask'];

function choose(cards, previous, random) {
    const choices = cards.filter(card => card !== previous);
    return choices[Math.floor(random() * choices.length)];
}

function trafficRow(distance, slots, mirror, random) {
    const lanes = mirror ? [...slots].reverse() : slots;
    return {
        distance,
        lanes: lanes.map(key => (key === 'protest' ? `protest${Math.floor(random() * 3)}` : key)),
        exitLane: lanes.indexOf(EXIT)
    };
}

export function* streetCourse(random = Math.random) {
    const opening = choose(openings, null, random);
    const mirrorOpening = random() < 0.5;
    let distance = 28;
    for (const [i, slots] of opening.entries()) {
        if (i > 0) distance += 32;
        yield trafficRow(distance, slots, mirrorOpening, random);
    }

    let previousGate;
    let previousSequence;
    let protectionIndex = 0;
    for (let cycle = 0; ; cycle++) {
        const stage = stages[distance < 220 ? 0 : distance < 610 ? 1 : 2];
        const gap = stage.gap + Math.floor(random() * 4);
        if (cycle % 2 === 0) {
            yield {
                distance: distance + 21,
                pickupLane: Math.floor(random() * 3),
                pickup: protections[protectionIndex++ % protections.length]
            };
            distance += gap + 19;
        } else {
            distance += gap;
        }

        previousGate = choose(stage.gates, previousGate, random);
        yield trafficRow(distance, previousGate, random() < 0.5, random);

        previousSequence = choose(stage.sequences, previousSequence, random);
        const mirror = random() < 0.5;
        for (const slots of previousSequence) {
            distance += stage.gap;
            yield trafficRow(distance, slots, mirror, random);
        }
    }
}
