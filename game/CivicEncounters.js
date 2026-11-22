import { policeTape, fallenPlacard, marchBarrier, tapePost, tapeBottom, placardTop } from './CivicSigns.js';
import { horseCarriage, carriagePace, carriageAngle } from './HorseCarriage.js';

const gallopPhase = [0, 2.4, .6, 1.8];

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

export function configureCivic(obj, speed, reducedMotion) {
    obj.approachSpeed = Math.max(12, speed || 17.5);
    obj.stencil ??= obj.mesh.getObjectByName('roadStencil');
    obj.stencil.position.z = obj.approachSpeed * (obj.type === 'horseCarriage' ? .69 : .43);
    obj.stencil.castShadow = false;
    if (obj.type === 'policeTape') {
        obj.march ??= obj.mesh.getObjectByName('sidewalkMarch');
        obj.march.position.x = -obj.mesh.position.x;
    }
    if (obj.type !== 'horseCarriage') return;
    obj.carriage ??= obj.mesh.getObjectByName('carriage');
    obj.legs ??= ['FrontLeft','RearRight','FrontRight','RearLeft'].map(name =>
        obj.carriage.getObjectByName('leg'+name));
    obj.frontWheels ??= obj.carriage.getObjectByName('frontWheels');
    obj.backWheels ??= obj.carriage.getObjectByName('backWheels');
    obj.reducedMotion = reducedMotion;
    obj.carriage.rotation.y = obj.mesh.position.x > 0 ? -carriageAngle : carriageAngle;
    obj.bellRang = false;
    moveCarriage(obj);
}

export function moveCarriage(obj) {
    const t = obj.mesh.position.z / obj.approachSpeed;
    const travel = t * carriagePace;
    obj.carriage.position.z = travel;
    obj.frontWheels.rotation.x = obj.reducedMotion ? 0 : travel / .41;
    obj.backWheels.rotation.x = obj.reducedMotion ? 0 : travel / .59;
    for (let i = 0; i < obj.legs.length; i++) {
        obj.legs[i].rotation.x = obj.reducedMotion ? .035 : .48 * Math.sin(travel * 1.65 + gallopPhase[i]);
    }
    if (!obj.bellRang && t >= -1.33 && t < -.65) {
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
        z0 *= 1 + carriagePace/obj.approachSpeed;
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
