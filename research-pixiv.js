async function check() {
    console.log('--- Checking Pixiv Authors ---');
    const r = await fetch('https://www.pixiv.net/ranking.php?mode=daily&content=manga');
    const h = await r.text();
    
    // Intentar capturar del bloque JSON de metadatos
    const items = h.match(/\"illustId\":\"(\d+)\".*?\"illustTitle\":\"([^\"]+)\".*?\"userName\":\"([^\"]+)\"/g);
    if (items) {
        items.slice(0, 5).forEach(it => {
            const id = it.match(/\"illustId\":\"(\d+)\"/)[1];
            const title = it.match(/\"illustTitle\":\"([^\"]+)\"/)[1];
            const author = it.match(/\"userName\":\"([^\"]+)\"/)[1];
            console.log(`ID: ${id} | Title: ${title} | Author: ${author}`);
        });
    } else {
        console.log('None found with primary regex');
        const ids = h.match(/artworks\/(\d+)/g);
        console.log('Raw IDs found:', ids ? ids.slice(0, 5) : 'None');
    }
}
check();
