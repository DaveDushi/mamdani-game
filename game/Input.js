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
