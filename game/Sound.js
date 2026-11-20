const cues = {
    count: [[392, 0.085, 0]],
    go: [[783.99, 0.16, 0]],
    chase: [
        [146.83, 0.16, 0],
        [184.99, 0.13, 0.12],
        [174.61, 0.24, 0.23]
    ],
    escape: [
        [293.66, 0.12, 0],
        [349.23, 0.13, 0.1],
        [440, 0.2, 0.2]
    ],
    stunt: [
        [523.25, 0.1, 0],
        [783.99, 0.15, 0.08]
    ],
    haram: [
        [415.3, 0.11, 0],
        [311.13, 0.13, 0.09],
        [207.65, 0.23, 0.18]
    ],
    edition: [
        [392, 0.1, 0],
        [466.16, 0.15, 0.1],
        [587.33, 0.19, 0.21]
    ],
    stamp: [
        [660, 0.055, 0],
        [990, 0.1, 0.045]
    ],
    jump: [[230, 0.115, 0]],
    slide: [[125, 0.11, 0]],
    hit: [
        [96, 0.17, 0],
        [70, 0.19, 0.09]
    ],
    kafiyeh: [
        [293.66, 0.11, 0],
        [392, 0.23, 0.09]
    ],
    covidMask: [
        [783.99, 0.08, 0],
        [587.33, 0.14, 0.12],
        [392, 0.17, 0.24]
    ],
    rainbow: [
        [392, 0.12, 0],
        [493.88, 0.13, 0.075],
        [587.33, 0.17, 0.15],
        [783.99, 0.22, 0.225]
    ],
    start: [
        [294, 0.085, 0],
        [392, 0.09, 0.08],
        [494, 0.12, 0.16]
    ],
    end: [
        [294, 0.14, 0],
        [247, 0.17, 0.13],
        [196, 0.33, 0.28]
    ]
};

export class Sound {
    constructor() {
        this.enabled = localStorage.getItem('mamdani_sound') !== 'off';
    }
    unlock() {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context || !this.enabled) return;
        try {
            this.ctx ??= new Context();
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        } catch {}
    }
    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('mamdani_sound', this.enabled ? 'on' : 'off');
        if (this.enabled) {
            this.unlock();
            this.play('stamp');
            if (this.running) this.music(true);
        } else this.stopTrack();
    }
    music(running, restart = false) {
        this.running = running;
        if (!running || restart) this.stopTrack();
        if (restart) this.offset = 0;
        if (!running || !this.enabled || !this.ctx) return;
        if (!this.recording) {
            this.recording = fetch(import.meta.env.BASE_URL + 'audio/city-desk.m4a')
                .then((r) => {
                    // WKWebView can return status zero for a bundled capacitor:// resource.
                    if (!r.ok && !(r.status === 0 && location.protocol === 'capacitor:')) {
                        throw Error('Music unavailable');
                    }
                    return r.arrayBuffer();
                })
                .then((bytes) => this.ctx.decodeAudioData(bytes))
                .catch(() => {
                    this.recording = null;
                    return null;
                });
        }
        this.recording.then((buffer) => {
            if (!buffer || !this.running || !this.enabled || this.track) return;
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            this.musicVolume ??= this.ctx.createGain();
            this.musicVolume.gain.value = 0.22;
            source.connect(this.musicVolume);
            this.musicVolume.disconnect();
            this.musicVolume.connect(this.ctx.destination);
            this.offset = (this.offset || 0) % buffer.duration;
            source.start(0, this.offset);
            this.startedAt = this.ctx.currentTime;
            this.track = source;
        });
    }
    stopTrack() {
        if (!this.track) return;
        this.offset += this.ctx.currentTime - this.startedAt;
        this.track.stop();
        this.track.disconnect();
        this.track = null;
    }
    play(cue) {
        if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
        for (const [hz, duration, delay] of cues[cue] || []) {
            const start = this.ctx.currentTime + delay,
                osc = this.ctx.createOscillator(),
                vol = this.ctx.createGain();
            osc.type = cue === 'hit' ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(hz, start);
            if (cue === 'jump' || cue === 'slide')
                osc.frequency.exponentialRampToValueAtTime(
                    hz * (cue === 'jump' ? 1.8 : 0.55),
                    start + duration
                );
            vol.gain.setValueAtTime(0.0001, start);
            vol.gain.exponentialRampToValueAtTime(0.065, start + 0.009);
            vol.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            osc.connect(vol).connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + duration + 0.01);
            osc.onended = () => {
                osc.disconnect();
                vol.disconnect();
            };
        }
    }
}
