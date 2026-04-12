async function verify() {
    console.log('--- Verifying Pixiv Scraper V4 (Snake Case) ---');
    const fs = require('fs');
    let h;
    try {
        h = fs.readFileSync('pixiv_dump.html', 'utf8');
    } catch (e) {
        const r = await fetch('https://www.pixiv.net/ranking.php?mode=daily&content=manga');
        h = await r.text();
    }
    
    // El patrón real en Pixiv Ranking es snake_case y un orden específico
    // "title":"...","illust_id":...
    const matches = h.match(/\"title\":\"([^\"]+)\",\"illust_id\":(\d+),.*?\"user_name\":\"([^\"]+)\"/g);

    if (matches) {
        console.log(`Found ${matches.length} matches`);
        matches.slice(0, 5).forEach((m, i) => {
            const title = m.match(/\"title\":\"([^\"]+)\"/)?.[1];
            const id = m.match(/\"illust_id\":(\d+)/)?.[1];
            const user = m.match(/\"user_name\":\"([^\"]+)\"/)?.[1];
            console.log(`[${i+1}] ID: ${id} | Title: ${title} | Author: ${user}`);
        });
    } else {
        console.log('❌ Scraper V4 failed to find matches');
        // Intento 2: Capturar por separado y asociar si están cerca
        const ids = h.match(/\"illust_id\":(\d+)/g);
        console.log('IDs found:', ids ? ids.slice(0, 5).join(', ') : 'None');
    }
}
verify();
