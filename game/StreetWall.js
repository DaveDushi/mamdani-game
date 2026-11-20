// The plywood and rails on a STREET CLOSED panel. The long feet underneath
// support the fence; a runner reaches the wall itself at its striped front face.
export const closedPanel = {
    sideInset: 0.025, top: 2.5105, bottom: 0.1535, front: 0.1795, back: -0.0685
};

const shoulder = 0.24;
const bodyDepth = 0.27;

// Clip the runner's sweep to the time spent alongside the panel. Entering the
// side after the front has passed is a glance, even if the step ends in its middle.
export function wallContact(obj, halfWidth, startX, startY, end) {
    const { x, z } = obj.mesh.position;
    const fromZ = obj.previousZ;
    const near = -closedPanel.front - bodyDepth;
    const far = -closedPanel.back + bodyDepth;
    if (z < near || fromZ > far) return null;

    const travel = z - fromZ;
    const entry = travel ? Math.max(0, (near - fromZ) / travel) : 0;
    const exit = travel ? Math.min(1, (far - fromZ) / travel) : 1;
    const fromX = startX - x;
    const dx = end.x - startX;
    const dy = end.y - startY;
    const width = halfWidth - closedPanel.sideInset;
    const frontX = fromX + dx * entry;
    const underTop = closedPanel.top - 0.09;

    // Two closed panels can share a seam. Neither side of that seam is a lane out.
    if (Math.abs(frontX) <= width + shoulder && startY + dy * entry <= underTop) {
        const lane = Math.round(x / 3) + 1;
        const inner = Math.abs(frontX) <= width - shoulder ||
            obj.gate?.lanes?.[lane + Math.sign(frontX)] === 'gateBlock';
        if (inner && (fromZ <= near || !travel)) return 'wall';
    }

    let first = entry, last = exit;
    if (dx) {
        const left = (-width - shoulder - fromX) / dx;
        const right = (width + shoulder - fromX) / dx;
        first = Math.max(first, Math.min(left, right));
        last = Math.min(last, Math.max(left, right));
    } else if (Math.abs(fromX) > width + shoulder) return null;
    if (dy > 0) last = Math.min(last, (underTop - startY) / dy);
    else if (dy < 0) first = Math.max(first, (underTop - startY) / dy);
    else if (startY > underTop) return null;
    return first <= last ? 'gateBlock' : null;
}
