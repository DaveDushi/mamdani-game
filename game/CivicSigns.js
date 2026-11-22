import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { artTexture } from './Geometry.js';
import { StreetMesh, tile } from './StreetHazardMesh.js';

const regions = {
    tape: [0, 0, 768, 96], fares: [0, 96, 256, 206], rent: [256, 96, 256, 206],
    carriage: [512, 96, 256, 206], duck: [0, 304, 256, 103], jump: [256, 304, 256, 103],
    park: [512, 304, 256, 103], closed: [0, 410, 768, 102]
};
let ink;

// Batch a set of printed faces into a single draw, including bent tape and
// cardboard lying at an angle. Points run from bottom left counterclockwise.
export class CivicSigns {
    points = [];
    uv = [];
    indices = [];

    face(name, points, left = 0, right = 1) {
        const [x, y, w, h] = regions[name];
        const i = this.points.length / 3;
        for (const point of points) this.points.push(...point);
        for (const [u, v] of [[left, 1], [right, 1], [right, 0], [left, 0]]) {
            this.uv.push((x + 1.5 + u * (w - 3)) / 768, 1 - (y + 1.5 + v * (h - 3)) / 512);
        }
        this.indices.push(i, i+1, i+2, i, i+2, i+3);
    }

    plaque(name, x, y, z, w, h, tilt = 0) {
        this.face(name, [[x-w/2,y-h/2-tilt,z], [x+w/2,y-h/2+tilt,z],
            [x+w/2,y+h/2+tilt,z], [x-w/2,y+h/2-tilt,z]]);
    }

    finish() {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(this.points, 3));
        geometry.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
        geometry.setIndex(this.indices);
        geometry.computeBoundingSphere();
        ink ??= new MeshBasicMaterial({ map: artTexture('civic-signs'), toneMapped: false });
        return new Mesh(geometry, ink);
    }
}

export function roadStencil(name) {
    const sign = new CivicSigns();
    sign.face(name, [[-1.02,.037,2.3],[1.02,.037,2.3],[1.02,.037,-2.3],[-1.02,.037,-2.3]]);
    const mesh = sign.finish();
    mesh.name = 'roadStencil';
    return mesh;
}

function marchers() {
    const m = new StreetMesh(), signs = new CivicSigns();
    for (const side of [-1, 1]) {
        // The crowd stands behind blue police sawhorses on both sidewalks.
        const x = side * 5.6;
        for (const post of [-.70,.70]) for (const z of [-.25,.25]) {
            m.tube([x+post,.79,-1.1],[x+post+post*.13,.04,-1.1+z],.055,0x286ba6,5);
        }
        m.box(x,.82,-1.08,2.01,.25,.17,0x2867a1);
        for (const [i, coat, skin] of [[0,0xad5040,0x975d40],[1,0x426559,0xe1a87c],[2,0x343f64,0xbd8365]]) {
            const cx = x + (i-1)*.67, z = -1.55-(i%2)*.26;
            for (const leg of [-.13,.13]) m.tube([cx+leg,.09,z],[cx+leg*.68,.82,z],.083,0x41414a,6);
            m.tube([cx,.74,z],[cx,1.39,z],.212,coat,8,.25);
            m.tube([cx,1.40,z],[cx+.02,1.75,z],.139,skin,8,.155);
            m.tube([cx+.018,1.68,z-.01],[cx+.015,1.80,z-.022],.164,0x392e32,8,.13);
            m.tube([cx-.18,1.34,z],[cx-.28,.95,z+.02],.078,coat,6);
            m.tube([cx+.19,1.33,z],[cx+.26,1.13,z+.1],.075,coat,6);
            m.tube([cx+.26,1.13,z+.1],[cx+.32,1.58,z+.13],.059,skin,6);
            if (i === 1) continue;
            const h = i === 0 ? 2.36 : 2.7;
            m.box(cx+.30,(h+.97)/2,z+.13,.054,h-.97,.044,0xa77c51);
            signs.plaque(i === 0 ? 'fares' : 'rent',cx+.23,h,z+.165,.95,.69,side*(i===0?.09:-.065));
        }
    }
    const group = m.group();
    group.add(signs.finish());
    group.position.z = -5.2;
    group.name = 'sidewalkMarch';
    return group;
}

export const tapePost = 1.33, tapeBottom = 1.17, placardTop = .79;

export function marchBarrier() {
    const m = new StreetMesh(), signs = new CivicSigns();
    // Welded crowd-control fence in the two CLOSED lanes. Its front rail and
    // upper rim occupy the same contact plane as the other STREET CLOSED walls.
    const steel = 0x6c8c9b, policeBlue = 0x24567d;
    for (const x of [-1.40,1.40]) {
        m.box(x,.06,0,.16,.12,.83,steel);
        m.tube([x,.06,.045],[x,2.48,.045],.054,steel,8);
    }
    for (const y of [.23,1.86,2.45]) m.tube([-1.41,y,.047],[1.41,y,.047],.056,steel,8);
    for (let i=-5;i<=5;i++) {
        const x = i*.237;
        m.tube([x,.24,.048],[x,2.45,.048],.028,policeBlue,6);
    }
    m.box(0,1.48,.095,2.89,.48,.165,policeBlue);
    signs.plaque('closed',0,1.48,.179,2.86,.46);
    for (const x of [-1.30,1.30]) m.box(x,.66,.08,.17,.52,.08,0xd6dee0);
    const group=m.group();
    group.add(signs.finish());
    return group;
}

export function policeTape() {
    const m = new StreetMesh(), signs = new CivicSigns();
    for (const x of [-tapePost, tapePost]) {
        m.tube([x,.013,0],[x,.13,0],.15,0x384453,8,.122);
        m.tube([x,.09,0],[x,2.05,0],.065,0x396c92,8);
        m.tube([x,1.9,0],[x,2.07,0],.082,0xffd15b,8);
    }
    for (const [l,r] of [[-tapePost,0],[0,tapePost]]) {
        const yl = tapeBottom + .12*Math.abs(l)/tapePost, yr = tapeBottom + .12*Math.abs(r)/tapePost;
        signs.face('tape', [[l,yl,.025],[r,yr,.025],[r,yr+.34,.025],[l,yl+.34,.025]],
            (l+tapePost)/(2*tapePost),(r+tapePost)/(2*tapePost));
        m.face([[l,yl+.53,-.01],[r,yr+.53,-.01],[r,yr+.64,-.01],[l,yl+.64,-.01]],tile.paint,0xffd34b);
    }
    signs.plaque('duck',0,1.78,.05,.84,.32);
    const group = m.group();
    group.add(signs.finish(), roadStencil('duck'), marchers());
    return group;
}

export function fallenPlacard() {
    const m = new StreetMesh(), signs = new CivicSigns();
    // A cardboard picket sign has slipped onto a dropped megaphone. The
    // exposed wooden handle and face still match the signs in the march.
    m.tube([-.14,.29,.16],[-.52,.045,.96],.057,0xa97744,4);
    m.tube([-.73,.33,-.36],[.51,.33,-.50],.11,0xb84140,12,.35);
    m.tube([.49,.33,-.50],[.56,.33,-.51],.35,0xd7c9ac,12,.34);
    const board = [[-1.19,.07,.53],[1.17,.12,.49],[1.22,placardTop,-.36],[-1.12,.74,-.32]];
    const back = board.map(([x,y,z]) => [x,y-.038,z-.036]);
    for (let i=0; i<4; i++) {
        const j = (i+1)%4;
        m.face([board[i],back[i],back[j],board[j]],tile.paint,0xa87b50);
    }
    signs.face('fares',board);
    const group = m.group();
    group.add(signs.finish(), roadStencil('jump'));
    return group;
}
