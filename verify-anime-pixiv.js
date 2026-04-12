async function verify() {
    console.log('--- Verifying MyAnimeList (Jikan) ---');
    const animeRes = await fetch('https://api.jikan.moe/v4/top/anime?limit=5');
    const animeData = await animeRes.json();
    console.log('Top 1 Anime:', animeData.data[0].title);
    
    const mangaRes = await fetch('https://api.jikan.moe/v4/top/manga?limit=5');
    const mangaData = await mangaRes.json();
    console.log('Top 1 Manga:', mangaData.data[0].title);

    console.log('\n--- Verifying Pixiv Scraping ---');
    const pixivRes = await fetch('https://www.pixiv.net/ranking.php?mode=daily', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await pixivRes.text();
    const items = [];
    const matches = html.match(/data-id="(\d+)" data-title="([^"]+)"/g);
    if (matches) {
        console.log(`Found ${matches.length} Pixiv items`);
        for (let i = 0; i < 2; i++) {
            const m = matches[i].match(/data-id="(\d+)" data-title="([^"]+)"/);
            if (m) console.log(`Pixiv #${i+1}: ${m[2]} (ID: ${m[1]}) -> Proxy: https://pixiv.cat/${m[1]}.jpg`);
        }
    } else {
        console.log('❌ No Pixiv matches found. Pixiv might be blocking or structure changed.');
    }
}

verify();
