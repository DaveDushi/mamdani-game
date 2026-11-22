import { createCivicSchedule, createStretchSchedule } from './CivicSchedule.js';
import { curbCutWindow } from './ParkRoute.js';
import { plainStreet } from './Stretches.js';

const EXIT = 'exit';
const protections = ['rainbow', 'kafiyeh', 'covidMask'];
const lanes = [0, 1, 2];
const stunts = ['jump', 'slide', 'rail', 'choice'];
const afterJump = ['jump', 'slide', 'slide', 'slide', 'rail', 'choice'];
const marathonLanding = ['slide', 'slide', 'slide', 'slide', 'slide', 'rail'];
const firstEncounterAt = { day: [290, 430], night: [215, 350] };
const lateTurnPatterns = [.42, .64, .88];
const MAX_PRESSURE = 5;

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
    { at: 0,     seconds: 1.14, move: .42, minimum: 2, maximum: 3 },
    { at: 350,   seconds: .77, move: .58, minimum: 3, maximum: 5 },
    { at: 1400,  seconds: .67, move: .66, minimum: 5, maximum: 7 },
    { at: 3500,  seconds: .64, move: .75, minimum: 6, maximum: 9 },
    { at: 8500,  seconds: .62, move: .84, minimum: 7, maximum: 11 },
    { at: 22000, seconds: .60, move: .91, minimum: 8, maximum: 13 },
    { at: 50000, seconds: .58, move: .96, minimum: 10, maximum: 16 }
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
    return gate === 'jump' || gate === 'rail' || gate === 'choice' || gate === 'jumpAll';
}

function jumpable(key) {
    return key === 'taxi' || key === 'trashPile';
}

function dressed(key, random) {
    return key === 'protest' ? 'protest' + Math.floor(random() * 3) : key;
}

function streetRow(distance, slots, cueStep, random) {
    return { distance, cueStep, exitLane: slots.indexOf(EXIT), lanes: slots.map(key => dressed(key, random)) };
}

export function* streetCourse(random = Math.random, mode = 'day', isOvertime = () => false, firstRun = false) {
    const night = mode === 'night';
    const selectCivic = createCivicSchedule(random, night ? 425 : 500);
    const nextStretch = createStretchSchedule(random);
    const introductions = night ? firstEncounterAt.night : firstEncounterAt.day;
    let distance = 0;
    let previous = [1];
    let previousJump = false;
    // The shortest wait the row just placed allows, in seconds at the street's base pace.
    let hold = .60;
    let tutorialsLeft = 3;
    let overtime = false;
    let street = plainStreet;
    let stretch = null;
    let plainRow = true;
    let curbCut = null;
    let closing = Infinity;
    let arriving = false;
    let pressure = 0;

    function advance(seconds, jump) {
        // Leave time to land and take off again from either option in a fork.
        if (previousJump && jump) seconds = Math.max(seconds, .93);
        seconds = Math.max(seconds, hold);
        hold = .60;
        previousJump = jump;
        const speed = courseSpeed(distance + 100, mode);
        distance += Math.ceil(seconds * speed);
        return Math.max(4, Math.round(speed * .14));
    }

    function approach() {
        return courseSpeed(distance, mode) * (overtime ? 1.1 : 1);
    }

    function tag(event) {
        plainRow = !!event.lanes && !event.encounter && event.iceLane === undefined;
        // Every lane a clean route may be in as it leaves this row.
        if (event.lanes) event.path = [...previous];
        if (stretch) {
            event.stretch = stretch;
            stretch.until = Math.max(stretch.until, distance);
        }
        return event;
    }

    function reachableLanes() {
        return lanes.filter(lane => previous.every(last => Math.abs(last - lane) <= 1));
    }

    function openRow(seconds, move, bonusRoute = false, bottle = false) {
        const reachable = reachableLanes();
        const lane = nextLane(previous[0], reachable, move, random);
        previous = [lane];
        const entrance = arriving;
        arriving = false;
        const slots = entrance ? [...street.pairs[0]] : bottle || random() < .32 ? ['alcohol', pick(street.blockers, random)] : [...pick(street.pairs, random)];
        if (random() < 0.5) slots.reverse();
        slots.splice(lane, 0, EXIT);
        const sideLanes = reachable.filter(other => Math.abs(lane - other) === 1);
        const bonusLane = bonusRoute && sideLanes.length ? pick(sideLanes, random) : undefined;
        if (bonusLane !== undefined) {
            if (slots[bonusLane] === 'alcohol') {
                const blockedLane = lanes.find(other => other !== lane && other !== bonusLane);
                slots[blockedLane] = 'alcohol';
            }
            slots[bonusLane] = pick(street.bonus, random);
            previous.push(bonusLane);
        }
        const cueStep = advance(seconds, bonusLane !== undefined && jumpable(slots[bonusLane]));
        const event = streetRow(distance, slots, cueStep, random);
        if (bonusLane !== undefined) event.bonusLane = bonusLane;
        return tag(event);
    }

    function skin(key) {
        if (key === 'gateBlock') return street.wall;
        if (key === 'jumpGate') return pick(street.jump, random);
        return key === 'slideGate' ? pick(street.slide, random) : undefined;
    }

    function gateRow(gate, seconds, move) {
        const cueStep = advance(seconds, canJump(gate));
        const everyLane = gate === 'jumpAll' ? 'jumpGate' : gate === 'slideAll' ? 'slideGate' : null;
        const slots = Array(3).fill(everyLane ?? 'gateBlock');
        if (everyLane) {
            previous = [1, 0, 2];
        } else {
            const reachable = reachableLanes();
            const lane = nextLane(previous[0], reachable, move, random);
            previous = [lane];
            slots[lane] = gate === 'choice' ? 'jumpGate' : gate + 'Gate';
            if (gate === 'choice') {
                const other = pick(reachable.filter(other => Math.abs(other - lane) === 1), random);
                slots[other] = 'slideGate';
                previous.push(other);
            }
        }
        const tutorial = tutorialsLeft > 0;
        if (tutorial) tutorialsLeft--;
        const event = { distance, lanes: slots, gate, tutorial, cueStep };
        if (!tutorial) {
            for (const key of new Set(slots)) {
                const model = skin(key);
                if (model) event.skin = { ...event.skin, [key]: model };
            }
        }
        return tag(event);
    }

    function movingRow(id, seconds, move, fork = false) {
        const reachable = reachableLanes();
        const exitLane = nextLane(previous[0], reachable, move, random);
        const boomLanes = reachable.filter(lane => Math.abs(lane - exitLane) === 1);
        if (!boomLanes.length) id = 'delivery-dolly';
        const dolly = id === 'delivery-dolly';
        const otherLane = pick(dolly ? lanes.filter(lane => Math.abs(lane - exitLane) === 1) : boomLanes, random);
        const blockedLane = lanes.find(lane => lane !== exitLane && lane !== otherLane);
        const position = !dolly && random() < .5 ? 'low' : 'high';
        const cueStep = advance(seconds, !dolly && (position === 'low' || fork));
        const approachSpeed = approach();
        const slots = [null, null, null];
        slots[otherLane] = dolly ? 'deliveryDolly' : 'signalBoom';
        if (fork && !dolly) slots[exitLane] = position === 'low' ? 'slideGate' : 'jumpGate';
        slots[blockedLane] = dressed(pick([...street.blockers, 'alcohol'], random), random);
        previous = dolly ? [exitLane] : [exitLane, otherLane];
        hold = .86 - pressure * .02;
        const encounter = dolly
            ? { id, fromLane: exitLane, toLane: otherLane, approachSpeed }
            : { id, lane: otherLane, position, approachSpeed };
        const event = { distance, lanes: slots, exitLane, cueStep, encounter };
        if (!dolly) event.actionLane = otherLane;
        return tag(event);
    }

    // A dry lane is always in reach. The runner may be skidding in either of the
    // others, so the next row waits for a thaw and opens in the middle.
    function iceRow(seconds, blocked) {
        const reachable = reachableLanes();
        const exitLane = nextLane(previous[0], reachable, .7, random);
        const beside = reachable.filter(lane => lane !== exitLane);
        const iceLane = pick(beside.length ? beside : lanes.filter(lane => lane !== exitLane), random);
        const cueStep = advance(seconds, false);
        const slots = [null, null, null];
        slots[iceLane] = 'rentIce';
        if (blocked || stretch.level > 1 && random() < .45) slots[3 - iceLane - exitLane] = dressed(pick(street.blockers, random), random);
        previous = [1, 0, 2];
        hold = 1.60;
        return tag({ distance, lanes: slots, iceLane, exitLane, cueStep });
    }

    function carriageRow(seconds, move, style = 'horse') {
        const exitLane = nextLane(previous[0], reachableLanes(), move, random);
        const lane = pick(lanes.filter(lane => Math.abs(lane - exitLane) === 1), random);
        const third = 3 - lane - exitLane;
        const cueStep = advance(seconds, false);
        const approachSpeed = approach();
        const slots = [null, null, null];
        slots[lane] = 'horseCarriage';
        previous = [exitLane, third];
        const encounter = { id: 'horse-carriage', lane, approachSpeed };
        if (style === 'team') {
            slots[third] = 'horseCarriage';
            previous = [exitLane];
        } else if (style === 'horse' && random() < .65) {
            // The way round is down one side only.
            slots[third] = dressed(pick(street.blockers, random), random);
            previous = [exitLane];
        } else if (style === 'swerve') {
            const from = lanes.filter(other => Math.abs(other - lane) === 1);
            encounter.fromLane = from.length > 1 && random() < .6 ? third : pick(from, random);
        }
        // The horse gallops down this road ahead of its own row. Keep it clear.
        hold = approachSpeed < 42 ? 1.42 : 1.08;
        return tag({ distance, lanes: slots, exitLane, cueStep, encounter });
    }

    function protestRow(beat, seconds, move) {
        const event = gateRow(beat === 'tape' ? 'slide' : 'jump', seconds, move);
        delete event.skin;
        event.encounter = { id: 'protest-line', beat, approachSpeed: approach() };
        hold = .78;
        return event;
    }

    function* stampTrail(from, to, startLane, endLane, limit) {
        const spacing = Math.max(3.2, courseSpeed(from, mode) * .09);
        const count = Math.min(limit, Math.floor((to - from) / spacing) + 1);
        if (count < 2) return;
        const trail = Array.from({ length: count }, (_, i) => i < count / 2 ? startLane : endLane);
        yield { distance: from, trail, spacing };
    }

    function lessonRow(at, gate) {
        distance = at;
        const speed = courseSpeed(distance, mode);
        const cueStep = Math.max(4, Math.round(speed * .14));
        const lead = Math.round(speed * 1.2);
        if (gate) {
            previous = [1, 0, 2];
            previousJump = gate === 'jumpAll';
            const key = previousJump ? 'jumpGate' : 'slideGate';
            return { distance, lanes: [key, key, key], gate, tutorial: true, cueStep, path: [...previous],
                lesson: { cue: previousJump ? 'hopCue' : 'duckCue', lead } };
        }
        const exitLane = random() < .5 ? 0 : 2;
        const slots = [null, pick(['taxi', 'protest0', 'protest1', 'trashPile', 'scaffold'], random), null];
        previous = [exitLane, 2 - exitLane];
        return { distance, lanes: slots, exitLane, cueStep, path: [...previous], lesson: { cue: exitLane ? 'moveRightCue' : 'moveLeftCue', lead } };
    }

    const lessonGap = night ? 1.12 : 1.38;
    if (night) {
        yield openRow(42 / courseSpeed(100, mode), 0.5);
        yield openRow(1.05, 0.6);
        yield gateRow('jump', lessonGap, .22);
        yield openRow(lessonGap, .50, false, true);
        yield gateRow('slide', lessonGap, .22);
        yield openRow(lessonGap + random() * .22, .60);
    } else if (firstRun) {
        // One idea per row and no walls: every lane of the hurdle and the beam is an answer.
        const stamps = 7;
        yield* stampTrail(18, 50, 1, 1, stamps);
        yield lessonRow(70);
        yield* stampTrail(84, 112, previous[0], 1, stamps);
        yield lessonRow(130, 'jumpAll');
        yield* stampTrail(146, 170, 1, 1, stamps);
        yield lessonRow(184, 'slideAll');
        yield* stampTrail(198, 222, 1, 1, stamps);
        distance = 208;
        yield openRow(lessonGap, .50, false, true);
        yield gateRow('jump', lessonGap, .22);
        yield gateRow('slide', lessonGap, .22);
    } else {
        // A runner who knows the moves meets a full street at once.
        yield openRow(32 / courseSpeed(100, mode), .4);
        for (let i = 0; i < 4; i++) yield openRow(1.28, .6, i === 3, i === 1);
        yield gateRow('jump', 1.28, .22);
        yield openRow(1.2, .55);
        yield gateRow('slide', 1.24, .22);
        yield openRow(1.2, .55, true);
    }

    let protectionIndex = Math.floor(random() * protections.length);
    let wearablesUntilBus = 1;
    let nextPickup = night ? 360 : 270;
    let tierIndex = 0;
    let introduced = 0;
    let lastStunt;
    let repeated = 0;
    let recentPatterns = [];
    let recentMotifs = [];
    let tier, effort, move;

    function readPace() {
        effort = night ? distance * 1.2 + 200 : distance;
        while (tierIndex + 1 < tiers.length && effort >= tiers[tierIndex + 1].at) tierIndex++;
        // Finish the set already in view before adding Overtime pressure.
        overtime = isOvertime();
        tier = tiers[Math.min(tierIndex + (overtime ? 1 : 0), tiers.length - 1)];
        pressure = stretch ? Math.min(MAX_PRESSURE, stretch.level - 1) + (overtime ? 1 : 0) : 0;
        move = effort >= 8500 ? pick(lateTurnPatterns, random) : Math.min(.9, tier.move + pressure * .03);
    }

    // Wearables rotate and a bus always has one on either side, so no pickup repeats.
    function* pickup() {
        const speed = courseSpeed(distance + 100, mode);
        const at = distance + Math.ceil(speed * .65);
        if (at < nextPickup || hold > 1 || curbCutWindow(distance, approach())?.near) return;
        const bus = wearablesUntilBus === 0;
        yield tag({ distance: at, pickupLane: previous[0], pickup: bus ? 'fastFreeBus' : protections[protectionIndex++ % protections.length] });
        wearablesUntilBus = bus ? (random() < .6 ? 2 : 3) : wearablesUntilBus - 1;
        nextPickup = at + Math.ceil(speed * ((night ? 15.5 : 14.5) + random() * 3.5));
        hold = Math.max(hold, 1.06);
    }

    function breakTime() {
        return Math.max(.84 - pressure * .03, tier.seconds + .08 - pressure * .02) + random() * Math.max(.1, .22 - pressure * .03);
    }

    function* breather() {
        readPace();
        const speed = courseSpeed(distance + 100, mode);
        const lead = hold > 1 ? 1.2 : distance + Math.ceil(speed * .65) >= nextPickup ? .95 : .62;
        const seconds = Math.max(lead + .98, 1.85 - effort / 9000) + random() * .2;
        const from = distance + Math.ceil(speed * lead);
        const to = distance + Math.floor(speed * (seconds - .55));
        yield* pickup();
        yield* stampTrail(from, to, previous[0], pick(reachableLanes(), random), 8);
        yield openRow(seconds, move);
    }

    // Two curb cuts lead in and out of Central Park. Each needs one wide gap
    // between ordinary rows, so make one if the street has not left it by chance.
    function openCurbCut() {
        const cut = curbCutWindow(distance, approach());
        if (!cut || cut.id === curbCut) return false;
        if (plainRow && cut.near) {
            hold = Math.max(hold, cut.seconds * (overtime ? 1.1 : 1));
            curbCut = cut.id;
        }
        return true;
    }

    // Draw a themed combination the stretch has earned, leaning toward its hardest ones.
    function pickMotif(room) {
        const taught = introduced === introductions.length;
        const earned = street.motifs.filter(({ level, beats }) => level <= stretch.level && beats.length <= Math.max(2, room + 1) &&
            (taught || !beats.some(beat => beat === 'dolly' || beat === 'boom')));
        const fresh = earned.filter(motif => !recentMotifs.includes(motif));
        const pool = fresh.length ? fresh : earned;
        let roll = random() * pool.reduce((sum, motif) => sum + motif.level, 0);
        const motif = pool.find(motif => (roll -= motif.level) < 0) ?? pool.at(-1);
        recentMotifs = [...recentMotifs.slice(-2), motif];
        return motif.beats.map(beat => [pick(beat.split('|'), random)]);
    }

    function pickPattern(room) {
        const available = patterns.filter(p => effort >= p.at && p.beats.length <= room && !recentPatterns.includes(p));
        if (!available.length) return [[]];
        const pattern = pick(available, random);
        recentPatterns = [...recentPatterns.slice(-2), pattern];
        return pattern.beats;
    }

    function pickMover() {
        const mover = pick(street.movers, random);
        return mover === 'swerve' && stretch.level < 2 ? 'horse' : mover;
    }

    function composeSet(length) {
        const sequence = [];
        while (sequence.length < length) {
            const room = length - sequence.length;
            const themed = street.motifs.length && (!sequence.length || random() < .38 + pressure * .03);
            sequence.push(...(themed ? pickMotif(room) : pickPattern(room)));
            // A loose beat keeps long sets from reading as printed blocks.
            if (sequence.length < length && random() < .55) sequence.push([]);
        }
        const taught = introduced === introductions.length;
        const linkChance = effort >= 22000 ? .82 : taught && distance >= 450 ? Math.min(.82, .5 + pressure * .06) : 0;
        if (sequence.length > 1 && random() < linkChance) {
            const at = 1 + Math.floor(random() * (sequence.length - 1));
            sequence.splice(at, 0, [pickMover()]);
            if (distance >= 30000 && sequence.length > at + 3 && random() < .74) {
                sequence.splice(at + 2 + Math.floor(random() * 2), 0, [pickMover()]);
            }
        }
        return sequence;
    }

    function chooseStunt(planned) {
        // More low runs at marathon pace keep the beat moving while the player lands.
        const options = previousJump && effort >= 50000 ? marathonLanding :
            previousJump && effort >= 800 ? afterJump : stunts;
        const mayFork = reachableLanes().length > 1;
        const allowed = options.filter(type => (repeated < 2 || type !== lastStunt) && (mayFork || type !== 'choice'));
        const gate = allowed.includes(planned) ? planned : pick(allowed, random);
        repeated = gate === lastStunt ? repeated + 1 : 1;
        lastStunt = gate;
        return gate;
    }

    function playBeat([beat, turn = move, timing], first) {
        const roll = random();
        const gap = timing ?? (roll < .36 ? -.06 - random() * .08 : roll < .86 ? -.04 + random() * .11 : .14 + random() * .18);
        const recovery = distance < 450 ? 1.02 : first ? .70 : .60;
        const seconds = Math.max(recovery, tier.seconds + gap - pressure * .026);
        const arrival = Math.max(.96 - pressure * .02, seconds) + random() * Math.max(.06, .16 - pressure * .02);
        switch (beat) {
            case 'dolly': return movingRow('delivery-dolly', arrival, move);
            case 'boom': return movingRow('signal-boom', arrival, move);
            case 'split': return movingRow('signal-boom', arrival, move, true);
            case 'horse': case 'swerve': case 'team': return carriageRow(arrival + .14, move, beat);
            case 'ice': case 'blackIce': return iceRow(arrival + .1, beat === 'blackIce');
            case 'tape': case 'placard': return protestRow(beat, Math.max(1.02 - pressure * .05, seconds + .12), move);
            case 'open': case 'fork': return openRow(Math.max(.82 - pressure * .02, seconds), move, beat === 'fork');
            case 'weave': return openRow(Math.max(.68, seconds - .04), Math.max(.8, move));
            case 'jumpAll': case 'slideAll': return gateRow(beat, Math.max(.72, seconds), move);
            default: return gateRow(chooseStunt(beat), seconds, turn);
        }
    }

    function* streetSet() {
        readPace();
        const curb = openCurbCut();
        const entering = arriving;
        if (!curb) yield* pickup();
        const taught = introduced === introductions.length;
        if (!curb && !arriving && taught && hold <= 1.06 && stretch?.id !== 'carriage' && selectCivic(distance)) {
            yield carriageRow(Math.max(1.6, breakTime()), move, distance > 6000 && random() < .35 ? 'swerve' : 'horse');
        } else {
            yield openRow(breakTime(), move, effort >= 450 && random() < .55);
        }
        if (!taught && distance >= introductions[introduced]) {
            yield movingRow(introduced++ ? 'signal-boom' : 'delivery-dolly', 1.65, move);
            if (!entering) return;
            // A new stretch still shows its own street in its first set.
            yield openRow(1.2, move);
            for (const beat of pickMotif(1)) yield playBeat(beat);
            return;
        }
        const sequence = composeSet(tier.minimum + (stretch ? 1 : 0) + Math.floor(random() * (tier.maximum - tier.minimum + 1 + pressure)));
        for (const [i, beat] of sequence.entries()) {
            if (i && distance >= closing) return;
            while (distance < closing && openCurbCut()) yield playBeat([]);
            if (i && distance >= nextPickup && hold <= 1) {
                yield* pickup();
                yield openRow(1.12, move);
            }
            yield playBeat(beat, i === 0);
        }
    }

    yield* pickup();
    yield gateRow('choice', lessonGap, .34);
    yield gateRow('rail', lessonGap, .34);
    while (true) {
        yield* breather();
        const { theme, level } = nextStretch();
        const speed = courseSpeed(distance + 100, mode);
        const length = Math.round(Math.min(620 + Math.max(0, speed - 45) * 8, Math.max(330, speed * (11 + Math.min(level, 5) * .8 + random() * 3))));
        const at = distance + Math.ceil(speed * .35);
        street = theme;
        stretch = { id: theme.id, name: theme.name, level, at, until: at + length };
        arriving = true;
        closing = stretch.until - speed * 1.2;
        while (distance < closing) yield* streetSet();
        closing = Infinity;
        street = plainStreet;
        stretch = null;
    }
}
