import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Shape, ShapeGeometry, Vector2 } from 'three';
import { Batch, labelMaterial } from './Geometry.js';

const width = 2.96;
export const slideClearance = 1.38;
export const railClearance = 1.1;
export const railInnerFoot = 1.1;
export const skillGateBounds = {
    jumpGate: [width / 2, 1.08, 0.62],
    slideGate: [width / 2, 2.44, 0.62],
    railGate: [width / 2, 1.28, 0.62],
    gateBlock: [width / 2, 2.68, 0.62]
};
const reflective = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });

function gateModel(key, bottom, color, sign) {
    const [, top, depth] = skillGateBounds[key];
    const height = top - bottom;
    const middle = bottom + height / 2;
    const frame = 0x302e38;
    const markings = 0xe6c54e;
    const batch = new Batch();
    batch.box(frame, 0, middle, 0, width, height, depth * 2);
    const trim = new Batch();
    for (const y of [bottom + 0.095, top - 0.095])
        trim.box(color, 0, y, depth + 0.009, width, 0.11, 0.02);
    for (const side of [-1, 1]) {
        batch.box(frame, side * (width / 2 - 0.085), top / 2, 0, 0.17, top, depth * 2);
        for (const y of [bottom + 0.25, top - 0.17])
            trim.box(markings, side * 1.3, y, depth + 0.019, 0.13, 0.21, 0.025, 0, 0, -side * 0.55);
        if (bottom) trim.box(color, side * 1.39, bottom / 2, depth + 0.009, 0.075, bottom * 0.74, 0.02);
    }
    const model = new Group();
    model.add(batch.mesh(), trim.mesh(reflective));
    if (sign) {
        const [face, paper, ink] = sign;
        const plate = new Mesh(new PlaneGeometry(2.4, height - 0.25), labelMaterial([face], paper, ink, 384, 144));
        plate.name = 'tutorialSign';
        plate.position.set(0, middle + 0.04, depth + 0.04);
        model.add(plate);
    }
    return model;
}

function ticketRail() {
    const [, top, footDepth] = skillGateBounds.railGate;
    const beamDepth = 0.24;
    const material = 0x4b3d36;
    const frame = new Batch();
    const trim = new Batch();
    const ivory = 0xffe8b1;
    const middle = (top + railClearance) / 2;
    frame.box(material, 0, middle, 0, width, top - railClearance, beamDepth * 2);
    trim.box(ivory, 0, middle, beamDepth + 0.01, width, 0.13, 0.02);
    for (const side of [-1, 1]) {
        const x = side * (railInnerFoot + 0.18);
        frame.box(material, x, railClearance / 2, 0, 0.18, railClearance, 0.24);
        frame.box(material, x, 0.06, 0, 0.36, 0.12, footDepth * 2);
        trim.box(ivory, x, railClearance / 2, 0.13, 0.08, 0.86, 0.02);
        trim.box(0xf28d56, side * 1.35, middle, beamDepth + 0.025, 0.2, 0.14, 0.02);
    }
    const model = new Group();
    model.add(frame.mesh(), trim.mesh(reflective));
    return model;
}

export function skillGateModels() {
    return {
        jumpGate: gateModel('jumpGate', 0, 0xffdc69, ['↑ JUMP', '#ffdc69', '#29212a']),
        slideGate: gateModel('slideGate', slideClearance, 0xa5eff3, ['↓ SLIDE', '#a5eff3', '#16313e']),
        railGate: ticketRail(),
        gateBlock: gateModel('gateBlock', 0, 0xe18a62)
    };
}

const arrow = [[0, 1.65], [-0.87, 0], [-0.34, 0], [-0.34, -1.65], [0.34, -1.65], [0.34, 0], [0.87, 0]];
const chevron = [[0, 1.45], [-0.86, -0.4], [-0.86, -1.27], [0, 0.58], [0.86, -1.27], [0.86, -0.4]];

function roadCue(points, color, material) {
    const shape = new Shape(points.map(([x, y]) => new Vector2(x, y)));
    const geometry = new ShapeGeometry(shape);
    const batch = new Batch();
    batch.shape(geometry, 0x252934, 0, 0.029, 0, 1.16, 1.12, 1, -Math.PI / 2);
    batch.shape(geometry, color, 0, 0.035, 0, 1, 1, 1, -Math.PI / 2);
    geometry.dispose();
    return batch.mesh(material);
}

export function courseCueModels() {
    return {
        laneCue: roadCue(chevron, 0xf2e9d2, reflective),
        jumpCue: roadCue(arrow, 0xffdc69, reflective),
        slideCue: roadCue(arrow.map(([x, y]) => [x, -y]), 0xa5eff3, reflective)
    };
}
