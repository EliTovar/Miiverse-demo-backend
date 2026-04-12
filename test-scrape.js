const https = require('https');

https.get('https://top.gg/discord/servers/list/top', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const blocks = data.split('href="/discord/servers/543762244006256653"');
    console.log(blocks[1].substring(0, 500));
  });
});
