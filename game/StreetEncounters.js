import { boomLow, boomHigh, boomThickness, boomEnd, dollyDepth, dollyWidth, mastX } from './StreetEncounterArt.js';

const clamp01 = n => Math.max(0, Math.min(1, n));
const smooth = n => { const t = clamp01(n); return t*t*(3-2*t); };
const laneX = lane => (lane - 1) * 3;
const dollyStart = 1.45, dollyEnd = .12;
const MISS = 0, HIT = 1, ABOVE = 2, BELOW = 3;

function dollyX(obj, z) {
    return obj.startX + obj.crossing * clamp01((z / obj.approachSpeed + dollyStart) / (dollyStart + dollyEnd));
}

export function configureEncounter(obj, encounter, reducedMotion) {
    obj.approachSpeed = Math.max(12, encounter?.approachSpeed || 17.5);
    obj.reducedMotion = reducedMotion;
    if (obj.type === 'deliveryDolly') {
        obj.startX = encounter ? laneX(encounter.fromLane) : obj.mesh.position.x;
        obj.crossing = encounter ? laneX(encounter.toLane) - obj.startX : 0;
        obj.bay ??= obj.mesh.getObjectByName('deliveryBay');
        obj.nearCaster ??= obj.mesh.getObjectByName('nearCaster');
        obj.farCaster ??= obj.mesh.getObjectByName('farCaster');
    } else {
        obj.bottom = encounter?.position === 'high' ? boomHigh : boomLow;
        obj.boom ??= obj.mesh.getObjectByName('hydraulicBoom');
    }
    moveEncounter(obj);
}

export function moveEncounter(obj) {
    const pos = obj.mesh.position;
    if (obj.type === 'deliveryDolly') {
        pos.x = dollyX(obj, pos.z);
        obj.bay.position.x = obj.startX + obj.crossing - pos.x;
        const spin = obj.reducedMotion ? 0 : -(pos.x - obj.startX) / .17;
        obj.nearCaster.rotation.z = obj.farCaster.rotation.z = spin;
    } else {
        const t = pos.z / obj.approachSpeed;
        // Unfold from its transport stop, then lift/lower the carriage. Both
        // operations finish before the player reaches the length of the arm.
        obj.boom.rotation.z = .62 * (1 - smooth((t + 1.53) / .40));
        obj.boom.position.y = 1.13 + (obj.bottom + .36 - 1.13) * smooth((t + 1.13) / .41);
    }
}

// Intersect the same portion of this tick in all three dimensions. For a cart
// the relative lateral motion includes BOTH its wheels' travel and the runner's.
function sweepBox(obj, runner, startX, startY, offsetX, halfW, halfD, low, high) {
    const pos = obj.mesh.position, here = runner.mesh.position;
    const dz = pos.z - obj.previousZ, reach = halfD + .27;
    if (pos.z < -reach || obj.previousZ > reach) return MISS;
    let a = dz ? Math.max(0, (-reach - obj.previousZ) / dz) : 0;
    let b = dz ? Math.min(1, (reach - obj.previousZ) / dz) : 1;
    const cart = obj.type === 'deliveryDolly';
    const xA = (cart ? dollyX(obj, obj.previousZ + dz*a) : pos.x) + offsetX;
    const xB = (cart ? dollyX(obj, obj.previousZ + dz*b) : pos.x) + offsetX;
    const dx = here.x - startX, relA = startX + dx*a - xA, relB = startX + dx*b - xB;
    const change = relB - relA, width = halfW + .24;
    if (change) {
        const t0 = (-width - relA)/change, t1 = (width - relA)/change;
        const enter = Math.max(0, Math.min(t0,t1)), leave = Math.min(1, Math.max(t0,t1));
        if (enter > leave) return MISS;
        const span = b - a;
        b = a + span*leave;
        a += span*enter;
    } else if (Math.abs(relA) > width) return MISS;
    const dy = here.y - startY, ya = startY + dy*a, yb = startY + dy*b;
    if (Math.min(ya,yb) + .09 > high) return ABOVE;
    if (Math.max(ya,yb) + (runner.slideTimer > 0 ? .89 : 1.87) < low) return BELOW;
    return HIT;
}

// The handrail and parcels occupy different heights. A shoe passing over
// the empty corner of the flatbed should clear it.
const cargo = [
    [0,dollyWidth,dollyDepth,.22,.41], [0,.70,.50,.41,.922],
    [-.02,.595,.463,.907,1.398], [-.14,.466,.415,1.397,1.968],
    [-.68,.067,.379,.36,1.687], [-.49,.17,.53,0,.32], [.49,.17,.53,0,.32]
];

export function encounterContact(obj, runner, startX, startY) {
    const z = obj.mesh.position.z, depth = obj.type === 'deliveryDolly' ? dollyDepth : .40;
    if (z < -depth - .27 || obj.previousZ > depth + .27) return null;
    if (obj.type === 'deliveryDolly') {
        let cleared = false;
        for (let i = 0; i < cargo.length; i++) {
            const part = cargo[i];
            const result = sweepBox(obj,runner,startX,startY,part[0],part[1],part[2],part[3],part[4]);
            if (result === HIT) return 'hit';
            if (result === ABOVE) cleared = true;
        }
        if (cleared) return 'jump';
        if (sweepBox(obj,runner,startX,startY,0,dollyWidth+.43,dollyDepth,0,1.97) === HIT) return 'sidestep';
    } else {
        if (sweepBox(obj,runner,startX,startY,mastX,.255,.40,0,.136) === HIT ||
            sweepBox(obj,runner,startX,startY,mastX,.166,.238,.136,2.34) === HIT) return 'hit';
        const result = sweepBox(obj,runner,startX,startY,(mastX+boomEnd)/2,(boomEnd-mastX)/2,.15,
            obj.bottom,obj.bottom+boomThickness);
        if (result === HIT) return 'hit';
        if (result === ABOVE) return 'jump';
        if (result === BELOW) return 'slide';
    }
    return null;
}
