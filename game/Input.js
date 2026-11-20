const keys = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'up',
    KeyW: 'up',
    Space: 'up',
    ArrowDown: 'down',
    KeyS: 'down'
};
export class Input {
    constructor(canvas, isActive) {
        this.pressed = new Set();
        let start = null;
        window.addEventListener('keydown', (e) => {
            if (!isActive() || !keys[e.code] || e.altKey || e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            if (!e.repeat) this.pressed.add(keys[e.code]);
        });
        canvas.addEventListener('pointerdown', (e) => {
            if (!isActive() || !e.isPrimary) return;
            start = [e.clientX, e.clientY];
            canvas.setPointerCapture(e.pointerId);
        });
        const swipe = (e) => {
            if (!start || !e.isPrimary || !isActive()) return;
            const dx = e.clientX - start[0],
                dy = e.clientY - start[1];
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 21) return;
            this.pressed.add(
                Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
            );
            start = null;
        };
        canvas.addEventListener('pointermove', swipe);
        canvas.addEventListener('pointerup', (e) => {
            swipe(e);
            start = null;
        });
        canvas.addEventListener('pointercancel', () => {
            start = null;
        });
        this.reset = () => {
            start = null;
            this.pressed.clear();
        };
    }
    isJustPressed(key) {
        return this.pressed.delete(key);
    }
}
