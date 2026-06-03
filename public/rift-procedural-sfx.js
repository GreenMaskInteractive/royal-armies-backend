/**
 * RIFT — Procedural UI sounds (Web Audio API, no bundled audio files).
 */
(function initRiftProceduralSfx(global) {
    'use strict';

    let audioContext = null;

    function getAudioContext() {
        const Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return null;

        if (!audioContext || audioContext.state === 'closed') {
            audioContext = new Ctx();
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

        return audioContext;
    }

    function scheduleTone(ctx, destination, {
        frequency,
        startOffset,
        duration,
        peakGain,
        type = 'triangle'
    }) {
        const now = ctx.currentTime;
        const start = now + startOffset;
        const end = start + duration;

        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(gain);
        gain.connect(destination);

        oscillator.start(start);
        oscillator.stop(end + 0.04);
    }

    function scheduleShimmer(ctx, destination, volume, startOffset = 0) {
        const duration = 0.38;
        const now = ctx.currentTime;
        const start = now + startOffset;
        const end = start + duration;
        const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));

        const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i += 1) {
            const decay = 1 - (i / sampleCount);
            samples[i] = (Math.random() * 2 - 1) * decay * decay;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3200, start);
        filter.Q.setValueAtTime(0.7, start);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.1), start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        source.start(start);
        source.stop(end + 0.02);
    }

    /**
     * Ascending gold chime — discovery / lore unlock fanfare.
     * @param {number} volume 0–1, already scaled by master/SFX mixer
     */
    function playDiscoveryUnlock(volume) {
        const level = Math.max(0, Math.min(1, Number(volume) || 0));
        if (level <= 0) return;

        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const bus = ctx.createGain();
        bus.gain.setValueAtTime(0.0001, now);
        bus.gain.exponentialRampToValueAtTime(1, now + 0.015);
        bus.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
        bus.connect(ctx.destination);

        scheduleShimmer(ctx, bus, level, 0);

        const notes = [
            { frequency: 523.25, startOffset: 0, duration: 0.2, peakGain: level * 0.5 },
            { frequency: 659.25, startOffset: 0.085, duration: 0.22, peakGain: level * 0.46 },
            { frequency: 783.99, startOffset: 0.17, duration: 0.26, peakGain: level * 0.48 },
            { frequency: 1046.5, startOffset: 0.28, duration: 0.5, peakGain: level * 0.44 }
        ];

        notes.forEach((note) => {
            scheduleTone(ctx, bus, note);
        });

        scheduleTone(ctx, bus, {
            frequency: 1318.51,
            startOffset: 0.34,
            duration: 0.55,
            peakGain: level * 0.22,
            type: 'sine'
        });
    }

    global.RiftProceduralSfx = {
        playDiscoveryUnlock
    };
}(typeof window !== 'undefined' ? window : globalThis));
