const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server.js');
let s = fs.readFileSync(file, 'utf8');
s = s.replace(/'RA-/g, "'NEXUS-").replace(/'NEXUS-NET-/g, "'RIFT-NET-");
fs.writeFileSync(file, s);
console.log('server.js error codes updated');
