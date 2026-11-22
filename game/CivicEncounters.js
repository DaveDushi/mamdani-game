import { policeTape, fallenPlacard, marchBarrier, tapePost, tapeBottom, placardTop } from './CivicSigns.js';
import { horseCarriage, carriagePace, carriageAngle } from './HorseCarriage.js';

// Hind pair, then fore pair, a beat apart on each side: a gallop rather than a trot.
const gallopPhase = [2.5, 0, 3.1, .6];
const GALLOP = 2 * Math.PI * 2.7;
// The horse waits at the far end of its empty road, then bolts.
const WAIT_SECONDS = 1.65, WAIT_METRES = 83;
const BELL_FROM = -1.6, BELL_TO = -.8;
const MERGE_FROM = -1.5, MERGE_TO = -.68;

export function civicModels() {
    return { horseCarriage: horseCarriage(), policeTape: policeTape(), fallenPlacard: fallenPlacard(), marchBarrier: marchBarrier() };
}

export function civicGateKey(key, encounter) {
    if (encounter?.id !== 'protest-line') return key;
    if (key === 'slideGate') return 'policeTape';
    if (key === 'jumpGate') return 'fallenPlacard';
    if (key === 'gateBlock') return 'marchBarrier';
    return key;
}

export function configureCivic(obj, encounter, reducedMotion) {
    obj.approachSpeed = Math.max(12, encounter?.approachSpeed || 17.5);
    obj.stencil ??= obj.mesh.getObjectByName('roadStencil');
    obj.stencil.position.z = obj.approachSpeed * (obj.type === 'horseCarriage' ? .95 : .43);
    obj.stencil.castShadow = false;
    if (obj.type === 'policeTape') {
        obj.march ??= obj.mesh.getObjectByName('sidewalkMarch');
        obj.march.position.x = -obj.mesh.position.x;
    }
    if (obj.type !== 'horseCarriage') return;
    obj.carriage ??= obj.mesh.getObjectByName('carriage');
    obj.horse ??= obj.carriage.getObjectByName('horse');
    obj.dust ??= obj.carriage.getObjectByName('hoofDust');
    obj.merge ??= obj.stencil.getObjectByName('mergePaint');
    obj.legs ??= ['FrontLeft','RearRight','FrontRight','RearLeft'].map(name =>
        obj.carriage.getObjectByName('leg'+name));
    obj.shins ??= obj.legs.map(leg => leg.getObjectByName('shin'));
    obj.frontWheels ??= obj.carriage.getObjectByName('frontWheels');
    obj.backWheels ??= obj.carriage.getObjectByName('backWheels');
    obj.reducedMotion = reducedMotion;
    obj.pace = carriagePace(obj.approachSpeed);
    obj.chargeAt = -Math.max(WAIT_SECONDS, WAIT_METRES / obj.approachSpeed);
    obj.mergeX = encounter?.fromLane === undefined ? 0 : (encounter.fromLane - 1) * 3 - obj.mesh.position.x;
    obj.merge.visible = obj.mergeX !== 0;
    obj.merge.position.set(obj.mergeX, 0, -3.4);
    // Painted at the lane it leaves, with the arrow bent into the lane it takes.
    obj.merge.scale.x = -Math.sign(obj.mergeX) || 1;
    obj.bellRang = true;
    moveCarriage(obj);
    obj.bellRang = false;
}

export function moveCarriage(obj) {
    const t = Math.max(obj.chargeAt, obj.mesh.position.z / obj.approachSpeed);
    const travel = t * obj.pace;
    const { carriage, legs, shins, horse, dust } = obj;
    carriage.position.z = travel;
    const along = Math.max(0, Math.min(1, (t - MERGE_FROM) / (MERGE_TO - MERGE_FROM)));
    // The lane change is finished well before the runner reaches it, so contact stays a straight sweep.
    carriage.position.x = obj.mergeX * (1 - along * along * (3 - 2 * along));
    const yaw = obj.mesh.position.x > 0 ? -carriageAngle : carriageAngle;
    carriage.rotation.y = yaw - Math.sign(obj.mergeX) * .34 * Math.sin(Math.PI * along);
    if (obj.reducedMotion) {
        obj.frontWheels.rotation.x = obj.backWheels.rotation.x = 0;
        horse.position.y = horse.rotation.x = 0;
        dust.visible = false;
        for (let i = 0; i < legs.length; i++) {
            const reach = i % 2 ? -.2 : .2;
            legs[i].rotation.x = -reach;
            shins[i].rotation.x = .1;
        }
    } else {
        obj.frontWheels.rotation.x = travel / .41;
        obj.backWheels.rotation.x = travel / .59;
        const stride = t * GALLOP;
        for (let i = 0; i < legs.length; i++) {
            const swing = Math.sin(stride + gallopPhase[i]);
            legs[i].rotation.x = .78 * swing;
            // The shin folds only while its leg is carried forward.
            shins[i].rotation.x = .95 * Math.max(0, Math.cos(stride + gallopPhase[i]));
        }
        horse.position.y = .07 * Math.sin(stride * 2) + .05;
        horse.rotation.x = .075 * Math.sin(stride + .7);
        dust.visible = true;
        dust.scale.setScalar(.75 + .35 * Math.sin(stride * 2 + 1));
    }
    if (!obj.bellRang && t >= BELL_FROM && t < BELL_TO) {
        obj.bellRang = true;
        return true;
    }
    return false;
}

// Clip the runner's swept footprint to one physical part in the part's own
// coordinate frame. Vertical clearance is measured only while alongside it.
function cross(x0,z0,x1,z1,y0,y1, head, cx,cz,w,d,bottom,top) {
    const dx = x1-x0, dz = z1-z0;
    let a = 0, b = 1;
    if (dz) {
        const l = (cz-d-z0)/dz, r = (cz+d-z0)/dz;
        a = Math.max(a,Math.min(l,r));
        b = Math.min(b,Math.max(l,r));
    } else if (Math.abs(z0-cz) > d) return null;
    if (dx) {
        const l = (cx-w-x0)/dx, r = (cx+w-x0)/dx;
        a = Math.max(a,Math.min(l,r));
        b = Math.min(b,Math.max(l,r));
    } else if (Math.abs(x0-cx) > w) return null;
    if (a>b) return null;
    const ya=y0+(y1-y0)*a, yb=y0+(y1-y0)*b;
    if (Math.min(ya,yb)+.09 > top) return 'jump';
    if (Math.max(ya,yb)+head < bottom) return 'slide';
    return 'hit';
}

// Local X, Z, half width/depth, bottom/top of the horse, shafts and coach.
const coachParts = [
    [0,1.18,.40,.88,.10,1.84], [0,1.88,.24,.53,1.45,2.67],
    [0,.12,.56,.65,.74,1.35], [0,-1.38,.83,1.05,0,2.32]
];

export function civicContact(obj, runner, startX, startY) {
    const p = runner.mesh.position, q = obj.mesh.position;
    if (q.z < -3.1 || obj.previousZ > 3.1) return null;
    let x0 = startX-q.x, x1 = p.x-q.x;
    let z0 = -obj.previousZ, z1 = -q.z;
    const head = runner.slideTimer > 0 ? .89 : 1.87;
    if (obj.type === 'horseCarriage') {
        const sin = Math.sin(obj.carriage.rotation.y), cos = Math.cos(obj.carriage.rotation.y);
        // The horse is back in a straight line here, closing at its own pace plus the street's.
        z0 *= 1 + obj.pace/obj.approachSpeed;
        z1 -= obj.carriage.position.z;
        const localX0 = cos*x0-sin*z0, localX1 = cos*x1-sin*z1;
        const localZ0 = sin*x0+cos*z0, localZ1 = sin*x1+cos*z1;
        for (const [x,z,w,d,low,high] of coachParts) {
            if (cross(localX0,localZ0,localX1,localZ1,startY,p.y,head,
                x,z,w+.24,d+.27,low,high) === 'hit') return 'hit';
        }
        return null;
    }
    if (obj.type === 'policeTape') {
        for (const x of [-tapePost,tapePost]) {
            if (cross(x0,z0,x1,z1,startY,p.y,head,x,0,.33,.35,0,2.07) === 'hit') return 'hit';
        }
        return cross(x0,z0,x1,z1,startY,p.y,head,0,0,tapePost+.24,.31,tapeBottom,1.96);
    }
    return cross(x0,z0,x1,z1,startY,p.y,head,0,.085,1.22+.24,.45+.27,0,placardTop);
}
