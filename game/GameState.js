export class GameState {
    constructor() {
        this.state = 'START'; // START, PLAYING, GAME_OVER
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
