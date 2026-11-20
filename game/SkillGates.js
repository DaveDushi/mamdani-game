import { Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
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
export function skillGateModels() {
    return streetGateArt(skillGateBounds, slideClearance, railClearance, railInnerFoot);
}

export function courseCueModels() {
    const stripe = new PlaneGeometry(0.23, 1.4).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
    const dash = new Mesh(stripe, new MeshBasicMaterial({ color: 0xc7c4b6, toneMapped: false }));
    return { laneCue: dash, jumpCue: dash.clone(), slideCue: dash.clone() };
}
