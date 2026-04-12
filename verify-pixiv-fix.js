async function verify() {
    console.log('--- Verifying Fixed Pixiv Scraping (All Ages) ---');
    const url = 'https://www.pixiv.net/ranking.php?mode=daily&content=illust';
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await res.text();
    const idMatches = html.match(/\/artworks\/(\d+)/g);
    if (idMatches) {
        const uniqueIds = Array.from(new Set(idMatches.map(m => m.match(/\d+/)[0])));
        console.log(`Found ${uniqueIds.length} unique IDs`);
        for (let i = 0; i < 5; i++) {
            const id = uniqueIds[i];
            const proxyUrl = `http://192.168.100.15:3000/games/proxy?url=${encodeURIComponent(`https://pixiv.cat/${id}.jpg`)}`;
            console.log(`Pixiv #${i+1}: ID ${id} -> Proxy: ${proxyUrl}`);
        }
    } else {
        console.log('❌ Failed to extract artworks from Pixiv HTML');
    }
}

verify();
