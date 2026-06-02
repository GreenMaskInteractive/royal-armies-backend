#!/usr/bin/env node
/**
 * [NEXUS] Render the Age of War trailer composition to MP4 using headless Chrome + bundled FFmpeg.
 *
 * Usage:
 *   npm install
 *   npm run render:trailer
 *
 * Options:
 *   --fps 30
 *   --crf 18
 *   --preset medium
 *   --output royal-armies-age-of-war-trailer.mp4
 *   --keep-frames
 *   --preview-sec 5   (only render first N seconds — quick smoke test)
 *
 * Remote progress sync (optional — shows overlay on royalarmies.com while rendering locally):
 *   set TRAILER_RENDER_SYNC_SECRET=your-shared-secret
 *   set TRAILER_RENDER_SYNC_URL=https://www.royalarmies.com/api/portal/trailer/render/progress
 *   npm run render:trailer
 */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_DIR = path.join(ROOT, 'dist', 'trailer');
const {
    markTrailerRenderStarting,
    markTrailerRenderProgress,
    markTrailerRenderComplete,
    markTrailerRenderFailed,
} = require('../nexus-trailer-render');

const CAPTURE_PROGRESS_MAX = 82;
const ENCODE_PROGRESS = 90;
const MUX_PROGRESS = 97;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
};

function parseArgs(argv) {
    const opts = {
        fps: 30,
        crf: 18,
        preset: 'medium',
        output: 'royal-armies-age-of-war-trailer.mp4',
        keepFrames: false,
        previewSec: 0,
        port: 0,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--fps') {
            opts.fps = Math.max(1, Number(argv[++i]) || 30);
        } else if (arg === '--crf') {
            opts.crf = Math.max(0, Number(argv[++i]) || 18);
        } else if (arg === '--preset') {
            opts.preset = String(argv[++i] || 'medium');
        } else if (arg === '--output') {
            opts.output = String(argv[++i] || opts.output);
        } else if (arg === '--keep-frames') {
            opts.keepFrames = true;
        } else if (arg === '--preview-sec') {
            opts.previewSec = Math.max(0, Number(argv[++i]) || 0);
        } else if (arg === '--port') {
            opts.port = Math.max(0, Number(argv[++i]) || 0);
        } else if (arg === '--help' || arg === '-h') {
            opts.help = true;
        }
    }

    return opts;
}

function printHelp() {
    console.log(`Royal Armies trailer renderer

  npm run render:trailer
  node scripts/render-trailer-video.js --preview-sec 5

Options:
  --fps 30                 Frame rate
  --crf 18                 H.264 quality (lower = better)
  --preset medium          x264 preset
  --output filename.mp4    Output file name (under dist/trailer/)
  --preview-sec N          Render only the first N seconds
  --keep-frames            Keep PNG frame sequence and video-only.mp4
  --port N                 Static server port (0 = random)
`);
}

function mimeFor(filePath) {
    return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function startStaticServer(publicDir, preferredPort) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            try {
                const rawPath = decodeURIComponent(String(req.url || '/').split('?')[0]);
                const safePath = rawPath.replace(/^\/+/, '');
                const filePath = path.resolve(publicDir, safePath || 'ageofwar-trailer-render.html');

                if (!filePath.startsWith(path.resolve(publicDir))) {
                    res.writeHead(403);
                    res.end('Forbidden');
                    return;
                }

                fs.readFile(filePath, (err, data) => {
                    if (err) {
                        res.writeHead(404);
                        res.end('Not found');
                        return;
                    }

                    res.writeHead(200, { 'Content-Type': mimeFor(filePath) });
                    res.end(data);
                });
            } catch (error) {
                res.writeHead(500);
                res.end(String(error));
            }
        });

        server.on('error', reject);
        server.listen(preferredPort || 0, '127.0.0.1', () => {
            const address = server.address();
            resolve({
                server,
                port: address && typeof address === 'object' ? address.port : preferredPort,
            });
        });
    });
}

function runFfmpeg(ffmpegPath, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(ffmpegPath, args, { stdio: 'inherit' });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg exited with code ${code}`));
        });
    });
}

function verifyFrameSequence(framesDir, totalFrames) {
    for (let i = 0; i < totalFrames; i += 1) {
        const framePath = path.join(framesDir, `frame_${String(i).padStart(6, '0')}.png`);
        if (!fs.existsSync(framePath)) {
            throw new Error(`Missing trailer frame ${i + 1}/${totalFrames}: ${framePath}`);
        }
    }
}

function buildTrailerMusicVolumeFilter(musicVolume) {
    const spec = musicVolume && typeof musicVolume === 'object' ? musicVolume : {};
    const musicStartSec = Number(spec.musicStartSec) || 2;
    const finaleStartSec = Number(spec.finaleStartSec) || musicStartSec;
    const rampSec = Math.max(0.05, Number(spec.rampSec) || 1.2);
    const fadeStartSec = Number(spec.fadeStartSec) || finaleStartSec + rampSec;
    const endSec = Math.max(fadeStartSec + 0.05, Number(spec.endSec) || fadeStartSec + 4);
    const baseVol = Number(spec.baseVol) || 0.4;
    const peakVol = Number(spec.peakVol) || 1;

    const tRampStart = Math.max(0, finaleStartSec - musicStartSec);
    const tRampEnd = tRampStart + rampSec;
    const tFadeStart = Math.max(tRampEnd, fadeStartSec - musicStartSec);
    const tEnd = Math.max(tFadeStart + 0.05, endSec - musicStartSec);
    const rampDur = Math.max(0.001, tRampEnd - tRampStart);
    const fadeDur = Math.max(0.001, tEnd - tFadeStart);

    const expr = [
        `if(lt(t,${tRampStart.toFixed(3)}),${baseVol.toFixed(4)}`,
        `if(lt(t,${tRampEnd.toFixed(3)}),${baseVol.toFixed(4)}+(${(peakVol - baseVol).toFixed(4)})*((t-${tRampStart.toFixed(3)})/${rampDur.toFixed(3)})`,
        `if(lt(t,${tFadeStart.toFixed(3)}),${peakVol.toFixed(4)}`,
        `if(lt(t,${tEnd.toFixed(3)}),${peakVol.toFixed(4)}*((${tEnd.toFixed(3)}-t)/${fadeDur.toFixed(3)}),0)`,
        ')',
        ')',
        ')',
        ')',
    ].join(',');

    return `volume='${expr}':eval=frame`;
}

async function waitForPaint(page) {
    await page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    }));
}

function reportCaptureProgress(frameIndex, totalFrames, timeSec) {
    const ratio = totalFrames > 0 ? (frameIndex + 1) / totalFrames : 0;
    const percent = Math.min(CAPTURE_PROGRESS_MAX, ratio * CAPTURE_PROGRESS_MAX);

    markTrailerRenderProgress({
        status: 'rendering',
        phase: 'capturing',
        percent: Number(percent.toFixed(1)),
        frame: frameIndex + 1,
        totalFrames,
        message: `Capturing frame ${frameIndex + 1} of ${totalFrames}`,
        timeSec: Number(timeSec.toFixed(2)),
    });
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        printHelp();
        return;
    }

    let puppeteer;
    let ffmpegPath;

    try {
        puppeteer = require('puppeteer');
        ffmpegPath = require('ffmpeg-static');
    } catch (_err) {
        console.error('[NEXUS] Missing render dependencies. Run: npm install');
        process.exit(1);
    }

    if (!ffmpegPath) {
        console.error('[NEXUS] ffmpeg-static did not provide a binary for this platform.');
        process.exit(1);
    }

    const framesDir = path.join(os.tmpdir(), `royal-armies-trailer-frames-${Date.now()}`);
    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const { server, port } = await startStaticServer(PUBLIC_DIR, opts.port);
    const pageUrl = `http://127.0.0.1:${port}/ageofwar-trailer-render.html`;

    console.log(`[NEXUS] Serving public/ on port ${port}`);
    console.log(`[NEXUS] Loading ${pageUrl}`);

    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--font-render-hinting=none',
            '--disable-dev-shm-usage',
        ],
    });

    try {
        const page = await browser.newPage();
        page.on('console', (msg) => {
            const text = msg.text();
            if (text.includes('Failed to load resource')) return;
            console.log(`[RIFT] ${text}`);
        });
        page.on('pageerror', (err) => console.error('[RIFT]', err.message));

        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction(
            () => window.RoyalArmiesTrailerExport && window.RoyalArmiesTrailerExport.isReady === true,
            { timeout: 240000, polling: 250 }
        );

        const config = await page.evaluate(() => window.RoyalArmiesTrailerExport.getExportConfig());
        const width = Number(config.width) || 1408;
        const height = Number(config.height) || 768;
        const durationSec = opts.previewSec > 0
            ? Math.min(opts.previewSec, Number(config.durationSec) || opts.previewSec)
            : Number(config.durationSec) || 120;
        const stageSelector = String(config.stageSelector || '#game-opening-prologue-trailer-stage');
        const fps = opts.fps;
        const totalFrames = Math.max(1, Math.ceil(durationSec * fps));

        await page.setViewport({ width, height, deviceScaleFactor: 1 });

        console.log(`[NEXUS] Rendering ${totalFrames} frames @ ${fps}fps (${durationSec.toFixed(2)}s, ${width}x${height})`);

        markTrailerRenderStarting({
            totalFrames,
            durationSec,
        });

        for (let i = 0; i < totalFrames; i += 1) {
            const t = Math.min(durationSec, i / fps);
            await page.evaluate((sec) => window.RoyalArmiesTrailerExport.seekTo(sec), t);
            await waitForPaint(page);

            const framePath = path.join(framesDir, `frame_${String(i).padStart(6, '0')}.png`);
            const stageHandle = await page.$(stageSelector);
            if (!stageHandle) {
                throw new Error(`Trailer stage not found: ${stageSelector}`);
            }

            await stageHandle.screenshot({ path: framePath, type: 'png' });
            await stageHandle.dispose();

            if (i === 0 || i === totalFrames - 1 || ((i + 1) % fps) === 0) {
                const pct = (((i + 1) / totalFrames) * 100).toFixed(1);
                console.log(`[NEXUS] Frame ${i + 1}/${totalFrames} (${pct}%) @ ${t.toFixed(2)}s`);
            }

            if (i === 0 || i === totalFrames - 1 || ((i + 1) % Math.max(1, Math.floor(fps / 2))) === 0) {
                reportCaptureProgress(i, totalFrames, t);
            }
        }

        const videoOnlyPath = path.join(OUTPUT_DIR, 'video-only.mp4');
        const outputPath = path.join(OUTPUT_DIR, opts.output);
        const narrationPath = path.join(PUBLIC_DIR, 'season', 'distressedwoman1.mp3');
        const musicPath = path.join(PUBLIC_DIR, 'audio', 'archimedeslullaby.wav');
        const sfxRelPath = String(config.subtitleImpactSfxPath || 'audio/explosionsfx.wav').replace(/^\/+/, '');
        const sfxPath = path.join(PUBLIC_DIR, sfxRelPath);
        const musicDelayMs = Math.round((Number(config.musicStartSec) || 2) * 1000);
        const sfxDelayMs = Math.round((Number(config.subtitleImpactSec) || 0) * 1000);
        const musicVolumeFilter = buildTrailerMusicVolumeFilter(config.musicVolume);

        if (!fs.existsSync(sfxPath)) {
            throw new Error(`Subtitle impact SFX not found: ${sfxPath}`);
        }

        markTrailerRenderProgress({
            status: 'rendering',
            phase: 'encoding',
            percent: CAPTURE_PROGRESS_MAX,
            frame: totalFrames,
            totalFrames,
            message: 'Encoding video…',
        });

        console.log('[NEXUS] Encoding video…');
        verifyFrameSequence(framesDir, totalFrames);
        await runFfmpeg(ffmpegPath, [
            '-y',
            '-framerate', String(fps),
            '-start_number', '0',
            '-i', path.join(framesDir, 'frame_%06d.png'),
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-crf', String(opts.crf),
            '-preset', opts.preset,
            '-movflags', '+faststart',
            videoOnlyPath,
        ]);

        markTrailerRenderProgress({
            status: 'rendering',
            phase: 'encoding',
            percent: ENCODE_PROGRESS,
            frame: totalFrames,
            totalFrames,
            message: 'Video encoded — muxing audio…',
        });

        console.log(`[NEXUS] Muxing narration + music + subtitle impact SFX @ ${(sfxDelayMs / 1000).toFixed(2)}s…`);
        await runFfmpeg(ffmpegPath, [
            '-y',
            '-i', videoOnlyPath,
            '-i', narrationPath,
            '-i', musicPath,
            '-i', sfxPath,
            '-filter_complex',
            `[1:a]volume=1.0[nar];[2:a]adelay=${musicDelayMs}|${musicDelayMs},${musicVolumeFilter}[mus];[3:a]adelay=${sfxDelayMs}|${sfxDelayMs},volume=1.0[sfx];[nar][mus][sfx]amix=inputs=3:duration=longest:dropout_transition=0[aout]`,
            '-map', '0:v:0',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-t', String(durationSec),
            '-movflags', '+faststart',
            outputPath,
        ]);

        markTrailerRenderProgress({
            status: 'rendering',
            phase: 'publishing',
            percent: MUX_PROGRESS,
            frame: totalFrames,
            totalFrames,
            message: 'Publishing trailer video…',
        });

        markTrailerRenderComplete(outputPath);
        console.log(`[NEXUS] Done: ${outputPath}`);
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
        if (!opts.keepFrames && fs.existsSync(framesDir)) {
            fs.rmSync(framesDir, { recursive: true, force: true });
        }
    }
}

main().catch((error) => {
    console.error('[NEXUS] Trailer render failed:', error);
    markTrailerRenderFailed(error);
    process.exit(1);
});
