import { stretchThemes } from './Stretches.js';

// Called at a free slot outside Carriage Row. Teaching and ice rows own their
// reserved space before the course asks for another visitor.
export function createCivicSchedule(random, carriageAt) {
    return function select(distance) {
        if (distance < carriageAt) return false;
        const early = distance < 1500;
        carriageAt = distance + (early ? 950 : 2600) + Math.floor(random() * (early ? 650 : 3600));
        return true;
    };
}

// Deals every theme once per round. A round never opens on the theme that closed
// the last one, and a theme's level counts its own visits.
export function createStretchSchedule(random) {
    const visits = new Map();
    let round = [];
    let last = null;
    return function next() {
        if (!round.length) {
            round = [...stretchThemes];
            for (let i = round.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [round[i], round[j]] = [round[j], round[i]];
            }
            if (round.at(-1) === last) round.unshift(round.pop());
        }
        last = round.pop();
        const level = (visits.get(last.id) ?? 0) + 1;
        visits.set(last.id, level);
        return { theme: last, level };
    };
}
