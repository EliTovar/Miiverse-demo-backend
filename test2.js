
async function test() {
  const res = await fetch('https://www.pixiv.net/ranking.php?mode=daily&content=manga', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();

  // JSON approach:
  const dataMatch = html.match(/data-items="([^"]+)"/);
  if (dataMatch) {
      const decoded = dataMatch[1].replace(/&quot;/g, '"');
      const json = JSON.parse(decoded);
      console.log('1st match JSON logic:', json[0].title, json[0].illust_id);
      console.log('Top 3 JSON:', json.slice(0,3).map(j => j.title));
  } else {
      console.log('data-items not found');
      // block approach:
      const blocks = html.split('{"title":');
      if (blocks.length > 1) {
          const titleMatch = blocks[1].match(/^"([^"]+)"/);
          console.log('1st match BLOCK logic:', titleMatch?.[1]);
      }
  }
}
test();
