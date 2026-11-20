import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Shape, ShapeGeometry, Vector2 } from 'three';
import { Batch, labelMaterial } from './Geometry.js';

const width = 2.96;
export const slideClearance = 1.38;
export const skillGateBounds = {
    jumpGate: [width / 2, 1.08, 0.62],
    slideGate: [width / 2, 2.44, 0.62],
    gateBlock: [width / 2, 2.68, 0.62]
};

function gateModel(key, bottom, face, paper, ink, signWidth) {
    const [, top, depth] = skillGateBounds[key];
    const height = top - bottom;
    const middle = bottom + height / 2;
    const frame = 0x302e38;
    const markings = 0xe6c54e;
    const batch = new Batch();
    batch.box(frame, 0, middle, 0, width, height, depth * 2);
    batch.box(markings, 0, bottom + 0.095, depth + 0.004, width, 0.13, 0.01);
    for (const side of [-1, 1]) {
        batch.box(frame, side * (width / 2 - 0.085), top / 2, 0, 0.17, top, depth * 2);
        for (const y of [bottom + 0.25, top - 0.17])
            batch.box(markings, side * 1.3, y, depth + 0.012, 0.13, 0.21, 0.025, 0, 0, -side * 0.55);
    }
    const model = new Group();
    const sign = new Mesh(
        new PlaneGeometry(signWidth, Math.min(1.12, height - 0.25)),
        labelMaterial([face], paper, ink, 384, 144)
    );
    sign.position.set(0, middle + 0.04, depth + 0.03);
    model.add(batch.mesh(), sign);
    return model;
}

export function skillGateModels() {
    return {
        jumpGate: gateModel('jumpGate', 0, '↑ JUMP', '#ffdc69', '#29212a', 2.4),
        slideGate: gateModel('slideGate', slideClearance, '↓ SLIDE', '#a5eff3', '#16313e', 2.4),
        gateBlock: gateModel('gateBlock', 0, '×', '#34313c', '#ffac8c', 1.46)
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
    const material = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    return {
        laneCue: roadCue(chevron, 0xf2e9d2, material),
        jumpCue: roadCue(arrow, 0xffdc69, material),
        slideCue: roadCue(arrow.map(([x, y]) => [x, -y]), 0xa5eff3, material)
    };
}
