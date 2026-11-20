import { Group, Mesh, PlaneGeometry } from 'three';
import { labelMaterial } from './Geometry.js';
import { StreetMesh, tile } from './StreetHazardMesh.js';

export const ICE_STEERING_SECONDS = .52;
const halfWidth = 1.04, halfLength = 2.65;

export function rentIceModel() {
    const ground = new StreetMesh();
    const rim = [1, .81, .95, .86, 1, .94, .96, .79, 1, .87, .95, .83].map((size, i) => {
        const angle = 2 * Math.PI * i / 12;
        return [Math.cos(angle) * halfWidth * size, .036, Math.sin(angle) * halfLength * size];
    });
    const tint = [0x9ad0df, 0x6fa2b6, 0x87b8cd, 0xb1d2dc];
    for (const [i, p] of rim.entries()) {
        const q = rim[(i + 1) % rim.length];
        ground.face([[.08, .039, .32], q, p], tile.paint, tint[i % tint.length]);
        const saltX = p[0] * .91, saltZ = p[2] * .91;
        for (let j = 0; j < 3; j++) {
            ground.box(saltX - j * .085, .045, saltZ + (i % 2 ? j : -j) * .09,
                .043 + .021 * j, .014, .043, j % 2 ? 0xe8eddf : 0xb3b9ac);
        }
    }
    ground.face([[-.72, .045, -.35], [-.69, .045, -.42], [.54, .045, 1.02], [.48, .045, 1.1]], tile.paint, 0xd9e9e5);
    ground.face([[-.52, .045, .92], [-.49, .045, .84], [-.08, .045, .25], [-.02, .045, .3]], tile.paint, 0xc4dfde);
    ground.box(.68, .24, 2.43, .07, .48, .09, 0x30404b);
    ground.box(.68, .57, 2.43, 1.04, .65, .081, 0x263d4d);
    const sign = new Mesh(new PlaneGeometry(1.01, .62), labelMaterial(['ICE', 'FREEZE THE RENT'], '#e4f4fa', '#192d3c', 256, 148));
    sign.position.set(.68, .57, 2.477);
    const model = new Group();
    model.add(ground.finish(true), sign);
    return model;
}

export function touchesRentIce(patch, runner, startX, startY) {
    const { x, z } = patch.mesh.position;
    const fromZ = patch.previousZ;
    if (z < -halfLength || fromZ > halfLength) return false;
    const footHeight = .08;
    if (startY > footHeight && runner.y > footHeight) return false;
    let first = 0, last = 1;
    if (startY > footHeight) first = (footHeight - startY) / (runner.y - startY);
    if (runner.y > footHeight) last = (footHeight - startY) / (runner.y - startY);

    // Find the closest grounded point along the sweep. The salted fringe is forgiving.
    const fromX = (startX - x) / halfWidth, along = fromZ / halfLength;
    const dx = (runner.x - startX) / halfWidth, dz = (z - fromZ) / halfLength;
    const travel = dx * dx + dz * dz;
    const closest = travel ? -(fromX * dx + along * dz) / travel : 0;
    const t = Math.max(first, Math.min(last, closest));
    return (fromX + dx * t) ** 2 + (along + dz * t) ** 2 <= .86 ** 2;
}
