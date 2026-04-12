const fs = require('fs');
const h = fs.readFileSync('pixiv_dump.html', 'utf8');

const items = [];
const blocks = h.split('{"title":');
console.log('Total blocks found:', blocks.length);

blocks.slice(1).forEach((block, i) => {
    // El primer bloque es basura antes del primer item
    const titleMatch = block.match(/^"([^"]+)"/);
    const idMatch = block.match(/"illust_id":(\d+)/);
    const userMatch = block.match(/"user_name":"([^"]+)"/);

    if (titleMatch && idMatch && userMatch) {
         const decode = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
         items.push({
             id: idMatch[1],
             title: decode(titleMatch[1]),
             author: decode(userMatch[1])
         });
    }
});

console.log('Total items parsed:', items.length);
items.slice(0, 5).forEach(it => console.log(it));
