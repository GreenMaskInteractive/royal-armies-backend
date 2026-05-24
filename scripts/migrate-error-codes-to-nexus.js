const fs = require('fs');
const path = require('path');

const rootSrc = fs.readFileSync(path.join(__dirname, '..', 'error-codes.js'), 'utf8');

let s = rootSrc
    .replace(
        /Royal Armies — canonical API error code registry \(RA-XXX-NNN\)\./,
        'NEXUS — canonical API error code registry (NEXUS-XXX-NNN). Network Environment Xypher Utility System.'
    )
    .replace(/public\/error-codes\.js/g, 'public/rift-error-codes.js')
    .replace(/buildRoyalArmiesErrorRegistry/g, 'buildNexusErrorRegistry')
    .replace(/createRoyalArmiesErrorRegistry/g, 'createNexusErrorRegistry')
    .replace(
        /root\.RoyalArmiesErrorCodes = registry;/,
        'root.RiftErrorCodes = registry;\n        root.NexusErrorCodes = registry;\n        root.RoyalArmiesErrorCodes = registry;'
    )
    .replace(/'RA-NET-/g, "'RIFT-NET-")
    .replace(/'RA-/g, "'NEXUS-");

const legacyBlock = `
    const LEGACY_RA_CODE_ALIASES = Object.create(null);
    Object.keys(ERROR_CODES).forEach((code) => {
        if (code.startsWith('NEXUS-')) {
            LEGACY_RA_CODE_ALIASES[code.replace(/^NEXUS-/, 'RA-')] = code;
        }
        if (code.startsWith('RIFT-')) {
            LEGACY_RA_CODE_ALIASES[code.replace(/^RIFT-/, 'RA-')] = code;
        }
    });

`;

s = s.replace(
    '    const LEGACY_MESSAGE_TO_CODE = Object.create(null);',
    legacyBlock + '    const LEGACY_MESSAGE_TO_CODE = Object.create(null);'
);

s = s.replace(
    /function resolveErrorCode\(input\) \{[\s\S]*?return 'NEXUS-GEN-001';\s*\}/,
    `function resolveErrorCode(input) {
        if (!input) return 'NEXUS-GEN-001';
        const key = String(input).trim();
        if (ERROR_CODES[key]) return key;
        if (LEGACY_RA_CODE_ALIASES[key]) return LEGACY_RA_CODE_ALIASES[key];
        if (STORE_ERROR_CODE_BY_KEY[key]) return STORE_ERROR_CODE_BY_KEY[key];
        if (LEGACY_MESSAGE_TO_CODE[key]) return LEGACY_MESSAGE_TO_CODE[key];
        return 'NEXUS-GEN-001';
    }`
);

fs.writeFileSync(path.join(__dirname, '..', 'nexus-error-codes.js'), s);

const riftHeader = `/**
 * RIFT — browser mirror of the NEXUS error code registry.
 * Runtime Instruction Flow Terminal (client JavaScript).
 */
`;
const rift = riftHeader + s;
fs.writeFileSync(path.join(__dirname, '..', 'public', 'rift-error-codes.js'), rift);

console.log('Created nexus-error-codes.js and public/rift-error-codes.js');
