async function verify() {
    console.log('--- Verifying Pixiv Scraper V3 (Handling &quot;) ---');
    const r = await fetch('https://www.pixiv.net/ranking.php?mode=daily&content=manga');
    const h = await r.text();
    
    const stateMatch = h.match(/(?:&quot;|\")illustId(?:&quot;|\"):(?:&quot;|\")(\d+)(?:&quot;|\").*?(?:&quot;|\")illustTitle(?:&quot;|\"):(?:&quot;|\")([^&\\\"]+)(?:&quot;|\").*?(?:&quot;|\")userName(?:&quot;|\"):(?:&quot;|\")([^&\\\"]+)(?:&quot;|\")/g);

    if (stateMatch) {
        console.log(`Found ${stateMatch.length} matches`);
        stateMatch.slice(0, 5).forEach(m => {
            const id = m.match(/illustId(?:&quot;|\"):(?:&quot;|\")(\d+)/)?.[1];
            const title = m.match(/illustTitle(?:&quot;|\"):(?:&quot;|\")([^&\\\"]+)/)?.[1];
            const author = m.match(/userName(?:&quot;|\"):(?:&quot;|\")([^&\\\"]+)/)?.[1];
            console.log(`ID: ${id} | Title: ${title} | Author: ${author}`);
        });
    } else {
        console.log('❌ Scraper V3 failed to find matches');
    }
}
verify();
