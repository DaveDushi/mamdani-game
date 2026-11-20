import { Group } from 'three';
import { StreetMesh, tile } from './StreetHazardMesh.js';

const white = 0xf4f0da, blue = 0x1762a4, deep = 0x103451;
const rubber = 0x242a32, glass = 0x618b9f, amber = 0xffcc64, steel = 0x758791;
const glyphs = {
    A: ['010','101','111','101','101'], E: ['111','100','110','100','111'],
    F: ['111','100','110','100','100'], R: ['110','101','110','101','101'],
    S: ['111','100','111','001','111'], T: ['111','010','010','010','010'],
    '&': ['010','101','010','101','011'], ' ': ['000','000','000','000','000'],
    M: ['10001','11011','10101','10001','10001'], 1: ['010','110','010','010','111'],
    5: ['111','100','111','001','111']
};

// Merge consecutive lit pixels into horizontal strips on the destination display.
function routeSign(mesh, text, y, z, px) {
    const width = [...text].reduce((n, c) => n + glyphs[c][0].length + 1, -1) * px;
    let x = -width / 2;
    const facing = Math.sign(z);
    for (const c of text) {
        const glyph = glyphs[c];
        for (let row = 0; row < glyph.length; row++) {
            for (const match of glyph[row].matchAll(/1+/g)) {
                const left = facing * (x + match.index * px);
                const right = left + facing * match[0].length * px;
                const top = y - row * px;
                mesh.face([[left,top-px,z],[right,top-px,z],[right,top,z],[left,top,z]], tile.paint, amber);
            }
        }
        x += (glyph[0].length + 1) * px;
    }
}

export function cityBusModel() {
    const m = new StreetMesh();
    const nose = -3.73, tail = 1.73, mid = (nose + tail) / 2, length = tail - nose;
    m.box(0,.48,mid,1.94,.47,length-.1,deep);
    m.box(0,1.22,mid,2.06,1.45,length,white);
    m.box(0,.60,mid,2.09,.38,length+.016,blue);
    m.box(0,.78,mid,2.09,.048,length+.024,0x4cb3cc);
    m.box(0,2.08,mid,2.08,.28,length-.045,blue);
    m.box(0,2.205,mid,1.99,.11,length-.09,white);
    for (const side of [-1,1]) {
        for (let i = 0; i < 6; i++) {
            const z = nose + .48 + i*.85;
            const door = side === 1 && (i === 0 || i === 3);
            m.box(side*1.039,door ? 1.18 : 1.65,z,.026,door ? 1.47 : .67,.79,rubber);
            m.box(side*1.055,1.66,z,.015,.55,.69,glass);
            m.box(side*1.065,1.68,z-.22,.008,.50,.018,0xa1b5b8);
            if (door) {
                m.box(side*1.056,.87,z,.016,.65,.66,0x447388);
                m.box(side*1.068,1.17,z,.013,1.46,.042,rubber);
            }
        }
        for (const z of [nose+.79,tail-.93]) m.wheel(side*1.026,.38,z,.38,.154);
        m.box(side*1.111,1.79,nose+.16,.12,.21,.115,deep);
    }
    for (const z of [nose,tail]) {
        const sign = Math.sign(z), face = z + sign*.01;
        m.box(0,1.64,face,1.88,.74,.035,rubber);
        m.box(0,1.64,face+sign*.022,1.72,.59,.015,glass);
        m.box(0,1.65,face+sign*.031,.044,.63,.016,rubber);
        m.box(0,2.063,face,1.90,.238,.049,rubber);
        routeSign(m,'FAST & FREE',2.154,face+sign*.027,.0355);
        for (const s of [-1,1]) {
            m.box(s*.85,.83,face,.205,.128,.052,sign > 0 ? 0xf15445 : 0xffe5a4);
            m.box(s*.85,.724,face,.205,.047,.054,amber);
            m.box(s*.57,2.193,face,.06,.035,.042,amber);
        }
        m.box(0,.387,face,2.07,.092,.12,0x566775);
    }
    // Distinct rear service panel, route plate and rooftop electric ventilation equipment.
    m.box(0,1.079,tail+.018,1.24,.24,.05,deep);
    routeSign(m,'M15',1.167,tail+.045,.036);
    for (const x of [-.63,.63]) for (let i=0;i<3;i++) m.box(x,.97+i*.048,tail+.015,.32,.016,.044,steel);
    m.box(0,2.31,-1.23,1.51,.16,2.44,0xc4ccc4);
    for (const z of [-1.75,-.71]) {
        m.tube([0,2.38,z],[0,2.41,z],.40,deep,16);
        m.tube([0,2.407,z],[0,2.423,z],.32,0x688490,16);
        for (let i=-2;i<=2;i++) m.box(i*.107,2.431,z,.024,.018,.47,0x344b56);
    }
    const bus = m.finish();
    bus.castShadow = true;
    return bus;
}
export function busPickup(bus) {
    const model = bus.clone();
    model.rotation.y = -.57;
    model.scale.setScalar(.46);
    model.position.set(.19,-.59,.29);
    const root = new Group();
    root.add(model);
    return root;
}
