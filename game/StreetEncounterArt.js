import { StreetMesh, tile } from './StreetHazardMesh.js';

export const dollyWidth = .76;
export const dollyDepth = .55;
export const mastX = -1.18;
export const boomEnd = 1.26;
export const boomLow = .13;
export const boomHigh = 1.14;
export const boomThickness = .74;

const milk = 0xfff4d1, iron = 0x323c43, steel = 0x9daeb3, brass = 0xffbf42;

// Small stencils are part of the rigid mesh, sharing the street atlas in night and day.
const type = {
    B: ['110','101','110','101','110'], D: ['110','101','101','101','110'],
    O: ['111','101','101','101','111'], T: ['111','010','010','010','010'],
    X: ['101','101','010','101','101']
};
function stencil(m, text, x, y, z, unit, color) {
    for (let n = 0; n < text.length; n++) {
        const glyph = type[text[n]];
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 3; col++) {
                if (glyph[row][col] !== '1') continue;
                const l = x + (4 * n + col) * unit, t = y - row * unit;
                m.face([[l,t-unit,z],[l+unit,t-unit,z],[l+unit,t,z],[l,t,z]], tile.paint, color);
            }
        }
    }
}

function cartWheel() {
    const m = new StreetMesh();
    m.tube([0, 0, -.071], [0, 0, .071], .17, 0x273138, 12);
    m.tube([0, 0, .071], [0, 0, .078], .109, 0xb9c9c4, 10);
    m.tube([0, 0, .078], [0, 0, .087], .047, iron, 8);
    for (let i = 0; i < 3; i++) {
        const a = 2 * i * Math.PI / 3;
        m.tube([.05 * Math.cos(a), .05 * Math.sin(a), .084],
            [.096 * Math.cos(a), .096 * Math.sin(a), .084], .012, iron, 4);
    }
    return m.finish();
}

function deliveryDolly() {
    const m = new StreetMesh();
    // Steel casters, a battered enamel flatbed and the tall U-shaped handrail.
    m.box(0, .30, 0, 2*dollyWidth, .15, 2*dollyDepth, 0x2c675c);
    m.box(0, .389, 0, 1.46, .035, 1.05, 0xc2b294, { top: tile.planks });
    for (const x of [-.49,.49]) {
        m.box(x, .228, .37, .12, .16, .22, steel);
        m.tube([x,.164,-.45],[x,.164,-.34],.161, iron, 10);
    }
    for (const z of [-.34,.34]) {
        m.tube([-.68,.35,z],[-.68,1.55,z],.037, 0xb55039, 8);
        m.tube([-.68,1.55,z],[-.71,1.64,z*.75],.037, 0xb55039, 8);
    }
    m.tube([-.71,1.64,-.255],[-.71,1.64,.255],.045, 0x2e3837, 8);
    // Ventilated dairy crate with bottles, then two different sizes of strapped cartons.
    m.box(0,.658,0,1.37,.49,.98,0x2d5b4c);
    for(const y of [.43,.64,.895]) m.box(0,y,0,1.40,.052,1.0,0x75b49a);
    for(const x of [-.63,-.42,-.21,0,.21,.42,.63]) m.box(x,.664,.50,.034,.46,.023,0x8dc5a6);
    m.box(-.02,1.153,-.012,1.19,.49,.90,0xcd9d67,{side:tile.plywood});
    m.box(-.14,1.676,-.018,.925,.558,.79,0xf2cc86,{side:tile.plywood});
    for (const x of [-.46,.13]) {
        m.box(x,1.681,.383,.045,.547,.012,0xb36b39);
        m.box(x,1.959,-.018,.045,.014,.791,0xdb9450);
    }
    m.box(-.015,1.166,.443,.428,.224,.014,milk);
    stencil(m,'BX',-.145,1.238,.452,.032,iron);
    // Two broad skid labels remain readable as shapes before the stencil comes into focus.
    m.box(-.19,1.724,.383,.39,.188,.012,0x285b4e);
    m.tube([-.28,1.747,.392],[-.28,1.747,.398],.058,0xffbc50,10);
    m.tube([-.16,1.699,.392],[-.16,1.699,.398],.049,0xeb7650,10);
    const root = m.group();
    const tire = cartWheel();
    for (const x of [-.49,.49]) {
        const wheel = tire.clone();
        wheel.name = x < 0 ? 'nearCaster' : 'farCaster';
        wheel.position.set(x,.17,.443);
        root.add(wheel);
    }
    const pads = new StreetMesh();
    // The stationary painted bay identifies where the moving load is headed.
    for (const x of [-1,1]) for (const z of [-1,1]) {
        pads.box(x*.871,.016,z*.65,.27,.012,.074,0xe4c577);
        pads.box(x*.969,.016,z*.51,.074,.012,.28,0xe4c577);
    }
    const bay = pads.finish(true);
    bay.name = 'deliveryBay';
    root.add(bay);
    return root;
}

function signalBoom() {
    const m = new StreetMesh();
    m.box(mastX,.068,0,.51,.136,.80,0x40484a);
    m.box(mastX,.175,0,.356,.16,.48,0xc4ba90);
    m.box(mastX,1.15,0,.247,1.92,.281,brass);
    m.box(mastX,1.14,.147,.15,1.80,.016,0x655a46);
    for(const x of [mastX-.107,mastX+.107]) m.tube([x,.23,.122],[x,2.07,.122],.024,steel,6);
    m.box(mastX,2.127,0,.31,.13,.334,iron);
    m.tube([mastX,2.192,0],[mastX,2.338,0],.09,0xffd665,10,.073);
    const root = m.group();
    const bar = new StreetMesh();
    const length = boomEnd - mastX;
    bar.box(length/2,.013,0,length,.735,.265,0xf3d78a,{front:tile.workStripe,back:tile.workStripe});
    bar.box(length/2,.357,0,length,.045,.30,0xffdb6b);
    bar.box(length/2,-.327,0,length,.061,.30,0x363e42);
    bar.box(1.13,.031,.148,.74,.314,.029,iron);
    stencil(bar,'DOT',.881,.14,.165,.043,milk);
    for(const x of [.13,length-.085]) bar.box(x,.006,.149,.089,.58,.025,milk);
    bar.tube([0,0,-.203],[0,0,.211],.184,steel,12);
    bar.tube([0,0,.211],[0,0,.234],.081,iron,10);
    const lift = bar.finish();
    lift.name = 'hydraulicBoom';
    lift.position.x = mastX;
    root.add(lift);
    return root;
}

export function encounterModels() {
    return { deliveryDolly: deliveryDolly(), signalBoom: signalBoom() };
}
