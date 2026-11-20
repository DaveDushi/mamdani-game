import { Group } from 'three';
import { CivicSigns, roadStencil } from './CivicSigns.js';
import { StreetMesh, tile } from './StreetHazardMesh.js';

export const carriagePace = 3.3, carriageAngle = .19;
const bay = 0x98522e, chestnut = 0xaf6840, mane = 0x352820, harness = 0x3e3030;
const ivory = 0xf5e1bc, wine = 0x782d40, brass = 0xd4a34f, iron = 0x333742;

// Cross sections from rump to chest, and poll to nose. Flat facets preserve
// the cheek, withers and muzzle when the horse is only a few pixels wide.
function sections(m, rows, color, sides = 10) {
    m.loft(rows.map(([z, y, rx, ry]) => Array.from({length:sides}, (_,i) => {
        const angle = i*2*Math.PI/sides;
        return [rx*Math.cos(angle),y+ry*Math.sin(angle),z];
    })),color);
}

function horse(m) {
    sections(m,[[.28,1.32,.19,.28],[.45,1.35,.37,.44],[.80,1.32,.40,.41],
        [1.22,1.36,.36,.45],[1.49,1.43,.30,.46],[1.66,1.48,.18,.34]],bay);
    sections(m,[[1.16,1.68,.26,.22],[1.41,1.84,.24,.43],[1.69,2.04,.19,.37],
        [1.86,2.12,.15,.23]],chestnut);
    sections(m,[[1.63,2.22,.16,.21],[1.84,2.24,.235,.245],[2,2.16,.21,.22],
        [2.22,2.015,.15,.17],[2.37,1.99,.146,.113]],bay);
    sections(m,[[2.25,2.0,.15,.135],[2.36,1.985,.151,.12],[2.405,1.998,.128,.075]],0x614337);
    for (const s of [-1,1]) {
        m.tube([s*.116,2.38,1.77],[s*.18,2.68,1.71],.091,bay,6,.014);
        m.tube([s*.12,2.435,1.806],[s*.17,2.61,1.753],.047,0xb57e69,5,.009);
        m.tube([s*.205,2.25,1.93],[s*.218,2.25,1.95],.040,0x231e21,8);
        m.tube([s*.12,2.027,2.373],[s*.125,2.03,2.385],.036,mane,6);
        // Blinkers, browband, noseband and brass bit rings.
        m.tube([s*.15,2.41,1.75],[s*.228,2.23,1.91],.025,harness,6);
        m.tube([s*.228,2.23,1.91],[s*.143,1.955,2.26],.025,harness,6);
        m.tube([s*.215,2.215,1.92],[s*.226,2.21,1.932],.084,harness,8);
        m.tube([s*.144,1.954,2.26],[s*.152,1.955,2.26],.043,brass,8);
        m.tube([s*.145,1.96,2.26],[s*.42,1.34,.67],.014,harness,5);
        m.tube([s*.42,1.34,.67],[s*.44,1.42,-.58],.015,harness,5);
        m.tube([s*.38,1.31,.58],[s*.42,1.24,1.42],.058,harness,5);
        m.tube([s*.30,1.78,1.35],[s*.39,1.29,1.43],.05,harness,6);
        m.tube([s*.39,1.29,1.43],[s*.31,1.14,1.53],.053,brass,6);
        m.tube([s*.35,1.73,.72],[s*.412,1.39,.73],.039,harness,6);
        m.tube([s*.412,1.39,.73],[s*.35,1.04,.73],.039,harness,6);
        m.tube([s*.46,1.21,1.31],[s*.60,.78,-.81],.04,wine,8);
    }
    m.tube([-.116,2.397,1.95],[.116,2.397,1.95],.033,brass,6);
    m.tube([-.136,2.105,2.26],[.136,2.105,2.26],.026,harness,6);
    m.face([[-.064,2.36,2.018],[-.029,2.13,2.302],[.029,2.13,2.302],[.072,2.36,2.018]],tile.paint,ivory);
    sections(m,[[1.08,1.77,.069,.064],[1.41,2.08,.091,.15],[1.63,2.30,.087,.15],
        [1.78,2.42,.081,.073]],mane,8);
    m.tube([0,1.56,.33],[-.065,1.25,.13],.13,mane,8,.118);
    m.tube([-.065,1.25,.13],[-.105,.61,-.04],.119,mane,8,.081);
    m.tube([-.105,.62,-.04],[-.15,.48,-.09],.084,mane,8,.025);
}

function leg(hind) {
    const m = new StreetMesh();
    const hock = hind ? -.16 : .04;
    m.tube([0,0,0],[0,-.47,hock],.127,bay,7,.081);
    m.tube([0,-.47,hock],[0,-.78,hock+.015],.079,chestnut,7,.052);
    m.tube([0,-.78,hock+.015],[0,-.98,.018],.056,ivory,7,.06);
    m.tube([0,-.98,.018],[0,-1.044,.051],.068,mane,7,.093);
    return m.finish();
}

function wheelAxle(radius, x) {
    const m = new StreetMesh();
    m.tube([-x,0,0],[x,0,0],.048,iron,8);
    for (const side of [-1,1]) {
        const at = (angle,r) => [side*x,r*Math.cos(angle),r*Math.sin(angle)];
        for (let i=0;i<20;i++) {
            const angle = Math.PI*i/10;
            m.tube(at(angle,radius-.030),at(angle+Math.PI/10,radius-.030),.041,ivory,5);
            if (i%2 === 0) m.tube(at(angle,.073),at(angle,radius-.049),.019,ivory,5);
        }
        m.tube([side*(x-.059),0,0],[side*(x+.06),0,0],.091,brass,10);
    }
    return m.finish();
}

function coach(m) {
    const l = -.71, r = .71;
    m.box(0,.72,-1.32,1.40,.135,1.89,iron);
    m.box(0,.90,-1.42,1.46,.25,1.67,ivory);
    m.box(0,1.105,-1.78,1.31,.19,.63,wine);
    m.box(0,1.30,-2.13,1.35,.47,.17,wine);
    m.box(0,1.14,-.77,1.14,.25,.44,wine);
    m.box(0,1.34,-.97,1.14,.32,.12,ivory);
    m.box(0,.74,-.285,1.47,.09,.28,ivory);
    // A bundled coachman in the high front seat, holding both reins.
    m.tube([-.20,1.23,-.76],[-.20,1.73,-.82],.17,0x2e403f,8,.20);
    m.tube([-.20,1.72,-.81],[-.20,2.01,-.79],.142,0xad7959,8,.136);
    m.tube([-.20,1.985,-.8],[-.20,2.024,-.8],.22,iron,12);
    m.tube([-.20,2.02,-.8],[-.20,2.19,-.81],.14,iron,10,.132);
    for (const s of [-1,1]) {
        m.tube([-.20+s*.16,1.66,-.79],[-.20+s*.20,1.41,-.50],.07,0x2e403f,6);
        m.tube([-.20+s*.20,1.41,-.50],[s*.44,1.42,-.58],.037,0xab785e,6);
    }
    for (const s of [-1,1]) {
        m.box(s*.719,1.13,-1.65,.076,.42,1.10,ivory);
        m.box(s*.76,1.28,-1.65,.025,.05,1.10,brass);
        m.tube([s*.695,.96,-.69],[s*.695,1.44,-.68],.034,brass,8);
        m.tube([s*.695,1.45,-.68],[s*.695,1.57,-.68],.084,0xffdfa0,8,.063);
        m.tube([s*.695,1.571,-.68],[s*.695,1.625,-.68],.089,iron,8,.03);
    }
    // A folding landau hood, open toward the horse. Ribs trace the curved canopy.
    const profile = [[-2.32,1.17],[-2.42,1.74],[-2.32,2.07],[-2.11,2.26],[-1.79,2.32],[-1.48,2.25]];
    for (let i=1;i<profile.length;i++) {
        const [a,h] = profile[i-1], [b,k] = profile[i];
        m.face([[l,h,a],[l,k,b],[r,k,b],[r,h,a]],tile.paint,0x462937);
        m.face([[l,h,a],[r,h,a],[r,k,b],[l,k,b]],tile.paint,0x603a49);
        for (const s of [-1,1]) {
            const x = s*.71;
            const panel = [[x,1.20,-1.96],[x,h,a],[x,k,b]];
            m.face(s < 0 ? panel.reverse() : panel,tile.paint,wine);
            m.tube([x+s*.009,1.20,-1.96],[x+s*.009,k,b],.020,brass,5);
        }
    }
    m.tube([l,2.25,-1.48],[r,2.25,-1.48],.045,brass,8);
    const sign = new CivicSigns();
    sign.plaque('park',0,2.215,-1.43,1.12,.36);
    return sign.finish();
}

export function horseCarriage() {
    const m = new StreetMesh();
    horse(m);
    const plate = coach(m), rig = m.group();
    rig.name = 'carriage';
    rig.add(plate);
    for (const s of [-1,1]) for (const hind of [true,false]) {
        const limb = leg(hind);
        limb.name = 'leg' + (hind ? 'Rear' : 'Front') + (s < 0 ? 'Left' : 'Right');
        limb.position.set(s*.235,1.09,hind?.53:1.39);
        rig.add(limb);
    }
    for (const [name,r,z,x] of [['backWheels',.59,-1.96,.80],['frontWheels',.41,-.67,.75]]) {
        const axle = wheelAxle(r,x);
        axle.name = name;
        axle.position.set(0,r,z);
        rig.add(axle);
    }
    const root = new Group();
    root.add(rig,roadStencil('carriage'));
    return root;
}
