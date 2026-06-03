/**
 * RIFT — Procedural UI sounds (Web Audio API, no bundled audio files).
 */
(function initRiftProceduralSfx(global) {
    'use strict';

    const SWOOSH_DURATION = 0.36;
    const CHIME_START_OFFSET = 0.2;

    let audioContext = null;

    function getAudioContext() {
        const Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return null;

        if (!audioContext || audioContext.state === 'closed') {
            audioContext = new Ctx();
        }

        return audioContext;
    }

    function resumeAudioContext(ctx) {
        if (!ctx || ctx.state !== 'suspended') {
            return Promise.resolve(ctx);
        }
        return ctx.resume().then(() => ctx).catch(() => ctx);
    }

    function scheduleTone(ctx, destination, {
        frequency,
        startOffset,
        duration,
        peakGain,
        type = 'sine'
    }) {
        const now = ctx.currentTime;
        const start = now + startOffset;
        const end = start + duration;

        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(gain);
        gain.connect(destination);

        oscillator.start(start);
        oscillator.stop(end + 0.05);
    }

    /** Rising band-pass noise sweep — cinematic swoosh in. */
    function scheduleDiscoverySwoosh(ctx, destination, level, startOffset = 0) {
        const now = ctx.currentTime;
        const start = now + startOffset;
        const end = start + SWOOSH_DURATION;
        const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * SWOOSH_DURATION));

        const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i += 1) {
            const t = i / sampleCount;
            const envelope = Math.sin(Math.PI * t);
            samples[i] = (Math.random() * 2 - 1) * envelope;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const lowPass = ctx.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.Q.setValueAtTime(0.6, start);
        lowPass.frequency.setValueAtTime(320, start);
        lowPass.frequency.exponentialRampToValueAtTime(5200, start + SWOOSH_DURATION * 0.62);
        lowPass.frequency.exponentialRampToValueAtTime(900, start + SWOOSH_DURATION);

        const highPass = ctx.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.setValueAtTime(180, start);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level * 0.62), start + 0.028);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        noise.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(gain);
        gain.connect(destination);

        noise.start(start);
        noise.stop(end + 0.03);
    }

    /** Bright excited major chime after the swoosh. */
    function scheduleDiscoveryChime(ctx, destination, level, startOffset = CHIME_START_OFFSET) {
        const notes = [
            { frequency: 783.99, delay: 0, duration: 0.11, gain: 0.42, type: 'sine' },
            { frequency: 987.77, delay: 0.06, duration: 0.12, gain: 0.48, type: 'sine' },
            { frequency: 1174.66, delay: 0.12, duration: 0.13, gain: 0.5, type: 'triangle' },
            { frequency: 1567.98, delay: 0.19, duration: 0.16, gain: 0.54, type: 'sine' },
            { frequency: 1975.53, delay: 0.28, duration: 0.22, gain: 0.5, type: 'triangle' },
            { frequency: 2637.02, delay: 0.36, duration: 0.42, gain: 0.46, type: 'sine' }
        ];

        notes.forEach((note) => {
            scheduleTone(ctx, destination, {
                frequency: note.frequency,
                startOffset: startOffset + note.delay,
                duration: note.duration,
                peakGain: level * note.gain,
                type: note.type
            });
        });

        scheduleTone(ctx, destination, {
            frequency: 3135.96,
            startOffset: startOffset + 0.44,
            duration: 0.55,
            peakGain: level * 0.28,
            type: 'sine'
        });
    }

    function playDiscoveryUnlockBus(ctx, level) {
        const now = ctx.currentTime;
        const bus = ctx.createGain();
        bus.gain.setValueAtTime(0.0001, now);
        bus.gain.exponentialRampToValueAtTime(1, now + 0.01);
        bus.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
        bus.connect(ctx.destination);

        scheduleDiscoverySwoosh(ctx, bus, level, 0);
        scheduleDiscoveryChime(ctx, bus, level, CHIME_START_OFFSET);
    }

    /**
     * Discovery popup — swoosh then excited chime.
     * @param {number} volume 0–1, already scaled by master/SFX mixer
     */
    function playDiscoveryUnlock(volume) {
        const level = Math.max(0, Math.min(1, Number(volume) || 0));
        if (level <= 0) return;

        const ctx = getAudioContext();
        if (!ctx) return;

        resumeAudioContext(ctx).then((activeCtx) => {
            if (!activeCtx || activeCtx.state !== 'running') return;
            playDiscoveryUnlockBus(activeCtx, level);
        });
    }

    global.RiftProceduralSfx = {
        playDiscoveryUnlock
    };
}(typeof window !== 'undefined' ? window : globalThis));
