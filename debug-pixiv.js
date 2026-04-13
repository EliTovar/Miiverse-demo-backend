const fs = require('fs');
async function test() {
  const res = await fetch('https://www.pixiv.net/ranking.php?mode=daily&content=manga', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();
  const blocks = html.split('{"title":');
  console.log('Blocks length:', blocks.length);
  const items = [];
  blocks.slice(1).forEach(block => {
    const titleMatch = block.match(/^"([^"]+)"/);
    const idMatch = block.match(/"illust_id":(\d+)/);
    const userMatch = block.match(/"user_name":"([^"]+)"/);
    if (titleMatch && idMatch && userMatch) {
      items.push({ id: idMatch[1], title: titleMatch[1], author: userMatch[1] });
    }
  });
  console.log('Items parsed:', items.length);
  console.log(items.slice(0, 5));
}
test();
