#!/usr/bin/env node
/**
 * Extract added FLEX lines from style2.css (main..season/age-of-war) into season overlay CSS.
 * Usage: node scripts/build-season-flex-css.js
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '..', 'public', 'season', 'season-age-of-war.flex.css');
const diff = execSync('git diff main..season/age-of-war -- public/style2.css', {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..')
});

const lines = diff.split('\n');
const added = [];

lines.forEach((line) => {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) return;
    if (line.startsWith('+')) {
        added.push(line.slice(1));
    }
});

const header = `/**
 * FLEX — Age of War seasonal overlay (local preview + merge to style2.css on ship).
 * Generated from: git diff main..season/age-of-war -- public/style2.css
 * Regenerate: node scripts/build-season-flex-css.js
 */
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + added.join('\n') + '\n', 'utf8');
console.log(`[NEXUS] Wrote ${added.length} lines → ${outPath}`);
