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
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_DIR = path.join(ROOT, 'dist', 'trailer');

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

async function waitForPaint(page) {
    await page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    }));
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

    const framesDir = path.join(OUTPUT_DIR, 'frames');
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
        }

        const videoOnlyPath = path.join(OUTPUT_DIR, 'video-only.mp4');
        const outputPath = path.join(OUTPUT_DIR, opts.output);
        const narrationPath = path.join(PUBLIC_DIR, 'season', 'distressedwoman1.mp3');
        const musicPath = path.join(PUBLIC_DIR, 'audio', 'archimedeslullaby.wav');
        const musicDelayMs = Math.round((Number(config.musicStartSec) || 2) * 1000);

        console.log('[NEXUS] Encoding video…');
        await runFfmpeg(ffmpegPath, [
            '-y',
            '-framerate', String(fps),
            '-i', path.join(framesDir, 'frame_%06d.png'),
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-crf', String(opts.crf),
            '-preset', opts.preset,
            '-movflags', '+faststart',
            videoOnlyPath,
        ]);

        console.log('[NEXUS] Muxing narration + music…');
        await runFfmpeg(ffmpegPath, [
            '-y',
            '-i', videoOnlyPath,
            '-i', narrationPath,
            '-i', musicPath,
            '-filter_complex',
            `[1:a]volume=1.0[nar];[2:a]adelay=${musicDelayMs}|${musicDelayMs},volume=0.45[mus];[nar][mus]amix=inputs=2:duration=longest:dropout_transition=0[aout]`,
            '-map', '0:v:0',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-t', String(durationSec),
            '-movflags', '+faststart',
            outputPath,
        ]);

        console.log(`[NEXUS] Done: ${outputPath}`);

        if (!opts.keepFrames) {
            fs.rmSync(framesDir, { recursive: true, force: true });
            if (fs.existsSync(videoOnlyPath)) {
                fs.unlinkSync(videoOnlyPath);
            }
        }
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
}

main().catch((error) => {
    console.error('[NEXUS] Trailer render failed:', error);
    process.exit(1);
});
