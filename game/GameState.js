export class GameState {
    constructor() {
        this.state = 'START'; // START, PLAYING, GAME_OVER
        this.paused = false;
    }

    setPaused(isPaused) {
        this.paused = isPaused;
    }

    isPaused() {
        return this.paused;
    }

    setState(newState) {
        this.state = newState;
    }

    isPlaying() {
        return this.state === 'PLAYING';
    }

    isGameOver() {
        return this.state === 'GAME_OVER';
    }
}
