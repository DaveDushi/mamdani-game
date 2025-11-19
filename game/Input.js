export class Input {
    constructor() {
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false
        };

        this.pressed = {
            left: false,
            right: false,
            up: false,
            down: false
        };

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Touch Support
        this.touchStartX = 0;
        this.touchStartY = 0;
        window.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        });
        window.addEventListener('touchend', (e) => this.handleSwipe(e));
    }

    handleSwipe(e) {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;

        const dx = touchEndX - this.touchStartX;
        const dy = touchEndY - this.touchStartY;

        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal
            if (Math.abs(dx) > 30) { // Threshold
                if (dx > 0) {
                    this.pressed.right = true;
                    this.keys.right = true;
                    setTimeout(() => this.keys.right = false, 100);
                } else {
                    this.pressed.left = true;
                    this.keys.left = true;
                    setTimeout(() => this.keys.left = false, 100);
                }
            }
        } else {
            // Vertical
            if (Math.abs(dy) > 30) {
                if (dy > 0) { // Down swipe
                    this.pressed.down = true;
                    this.keys.down = true;
                    setTimeout(() => this.keys.down = false, 100);
                } else { // Up swipe
                    this.pressed.up = true;
                    this.keys.up = true;
                    setTimeout(() => this.keys.up = false, 100);
                }
            }
        }
    }

    onKeyDown(e) {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                if (!this.keys.left) this.pressed.left = true;
                this.keys.left = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                if (!this.keys.right) this.pressed.right = true;
                this.keys.right = true;
                break;
            case 'ArrowUp':
            case 'KeyW':
            case 'Space':
                if (!this.keys.up) this.pressed.up = true;
                this.keys.up = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                if (!this.keys.down) this.pressed.down = true;
                this.keys.down = true;
                break;
        }
    }

    onKeyUp(e) {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = false;
                break;
            case 'ArrowUp':
            case 'KeyW':
            case 'Space':
                this.keys.up = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.down = false;
                break;
        }
    }

    // Helper to check if a key was pressed this frame (consume the event)
    isJustPressed(key) {
        if (this.pressed[key]) {
            this.pressed[key] = false;
            return true;
        }
        return false;
    }
}
