import { MeshBasicMaterial, Shape, ShapeGeometry, Vector2 } from 'three';
import { Batch } from './Geometry.js';
import { streetGateArt } from './StreetGateArt.js';

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

export function skillGateModels() {
    return streetGateArt(skillGateBounds, slideClearance, railClearance, railInnerFoot);
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
