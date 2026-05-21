const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'public', 'script.js'),
  path.join(__dirname, '..', 'public', 'style.css'),
  path.join(__dirname, '..', 'public', 'script2.js'),
  path.join(__dirname, '..', 'public', 'style2.css'),
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'public', 'ageportal.html'),
];

// Matches Block N, Block 25 Extension, | Block 10:, etc. — preserves label after colon
const BLOCK_LABEL_RE = /((?:\/\*[\s\*-]*|---\s*|<!--\s*|\|\s*)?)Block\s+\d+(?:\s+Extension)?(?:\s*:\s*|\s*:\s*)/gi;

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  let n = 0;
  text = text.replace(BLOCK_LABEL_RE, (match, prefix) => {
    n++;
    const isHtml = match.includes('<!--');
    if (isHtml) return `<!-- Block ${n}: `;
    if (prefix && prefix.includes('---')) return `/* --- Block ${n}: `;
    if (prefix && prefix.includes('/*')) return `/* Block ${n}: `;
    if (prefix && prefix.includes('|')) return `| Block ${n}: `;
    return `/* Block ${n}: `;
  });
  fs.writeFileSync(file, text, 'utf8');
  console.log(path.basename(file), 'total blocks:', n);
}
