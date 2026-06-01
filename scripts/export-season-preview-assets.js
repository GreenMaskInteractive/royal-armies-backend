#!/usr/bin/env node
/**
 * Copy seasonal RIFT bundles from season/age-of-war into public/season/ for local preview pages.
 * Usage: node scripts/export-season-preview-assets.js
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'public', 'season');
const branch = 'season/age-of-war';

const textFiles = [
    'public/age-music-flow.js',
    'public/rift-opening-prologue.js',
    'public/rift-subtitle-logo-sparks.js',
    'public/age-page.js',
    'public/age-view-tabs.js',
    'public/game.js'
];

const binaryFiles = [
    'public/images/royalarmiessubtitlelogo.png',
    'public/audio/distressedwoman.mp3'
];

fs.mkdirSync(outDir, { recursive: true });

textFiles.forEach((repoPath) => {
    const buf = execFileSync('git', ['show', `${branch}:${repoPath}`], { cwd: root });
    const base = path.basename(repoPath);
    const dest = path.join(outDir, base);
    fs.writeFileSync(dest, buf);
    console.log(`[NEXUS] ${base} (${buf.length} bytes)`);
});

binaryFiles.forEach((repoPath) => {
    const base = path.basename(repoPath);
    const dest = path.join(outDir, base);
    execFileSync('git', ['archive', branch, repoPath], {
        cwd: root,
        stdio: ['ignore', fs.openSync(dest, 'w'), 'inherit']
    });
    const size = fs.statSync(dest).size;
    console.log(`[NEXUS] ${base} (${size} bytes)`);
});

console.log('[NEXUS] Season preview assets exported. Run: node scripts/build-season-flex-css.js');
