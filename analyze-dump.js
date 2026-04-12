const fs = require('fs');
const h = fs.readFileSync('pixiv_dump.html', 'utf8');

console.log('--- Pixiv Dump Analysis ---');

// Buscar el ID que sabemos que está: 143408592
const id = '143408592';
let offset = h.indexOf(id);

while(offset !== -1) {
    const snippet = h.substring(offset - 100, offset + 100);
    console.log(`\nFound ID at ${offset}:`);
    console.log(JSON.stringify(snippet)); // Usar JSON.stringify para ver caracteres especiales
    offset = h.indexOf(id, offset + 1);
}

// Buscar "title"
console.log('\n--- Title search ---');
let tPos = h.indexOf('"title"');
if (tPos === -1) tPos = h.indexOf('&quot;title&quot;');

if (tPos !== -1) {
    console.log(`Found "title" at ${tPos}:`);
    console.log(JSON.stringify(h.substring(tPos, tPos + 500)));
} else {
    console.log('No "title" found in standard or escaped format');
}
