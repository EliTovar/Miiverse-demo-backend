import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PixivService {
  private readonly logger = new Logger(PixivService.name);
 
  private wrapProxy(url: string): string {
    return `http://192.168.100.15:3000/games/proxy?url=${encodeURIComponent(url)}`;
  }

  async getDailyRanking() {
    try {
      // MODIFICA AQUÍ: Cambia 'mode=daily' por 'mode=daily_r18' si deseas ver el ranking para adultos.
      // URL actual: https://www.pixiv.net/ranking.php?mode=daily&content=manga (Manga All Ages)
      const res = await fetch('https://www.pixiv.net/ranking.php?mode=daily&content=manga', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      const html = await res.text();
      
      const items: { id: string; title: string; author: string }[] = [];
      
      // Pixiv Ranking usa un estado JSON incrustado. 
      // La forma más robusta de extraerlo es dividir por el inicio de cada objeto de obra.
      const blocks = html.split('{"title":');
      
      blocks.slice(1).forEach(block => {
        const titleMatch = block.match(/^"([^"]+)"/);
        const idMatch = block.match(/"illust_id":(\d+)/);
        const userMatch = block.match(/"user_name":"([^"]+)"/);

        if (titleMatch && idMatch && userMatch) {
          const decode = (s: string) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          items.push({
            id: idMatch[1],
            title: decode(titleMatch[1]),
            author: decode(userMatch[1])
          });
        }
      });

      // Fallback a solo IDs si el scraping de títulos falla
      if (items.length === 0) {
        const idMatches = html.match(/\/artworks\/(\d+)/g);
        if (idMatches) {
            const uniqueIds = Array.from(new Set(idMatches.map(m => m.match(/\d+/)?.[0]).filter(id => id !== null)));
            for (let i = 0; i < Math.min(uniqueIds.length, 5); i++) {
                items.push({ id: uniqueIds[i] as string, title: `Manga ${uniqueIds[i]}`, author: 'Pixiv Artist' });
            }
        }
      }

      if (items.length === 0) throw new Error('No items parsed from Pixiv');

      return items.map((item, index) => ({
        appid: 8000 + index,
        name: item.title,
        author: item.author,
        image: this.wrapProxy(`https://pixiv.cat/${item.id}.jpg`)
      }));

    } catch (e) {
      this.logger.warn('⚠️ Pixiv Scraping failed, using high-quality fallback: ' + e.message);
      return this.getFallbackPixiv();
    }
  }

  private getFallbackPixiv() {
    // Lista de MANGAS populares VERIFICADOS hoy que funcionan con pixiv.cat
    return [
      { appid: 8001, name: 'Daily Manga 143408592', author: 'Pixiv Artist', image: this.wrapProxy('https://pixiv.cat/143408592.jpg') },
      { appid: 8002, name: 'Daily Manga 143393681', author: 'Pixiv Artist', image: this.wrapProxy('https://pixiv.cat/143393681.jpg') },
      { appid: 8003, name: 'Daily Manga 143385547', author: 'Pixiv Artist', image: this.wrapProxy('https://pixiv.cat/143385547.jpg') },
      { appid: 8004, name: 'Daily Manga 143382597', author: 'Pixiv Artist', image: this.wrapProxy('https://pixiv.cat/143382597.jpg') },
      { appid: 8005, name: 'Daily Manga 143378581', author: 'Pixiv Artist', image: this.wrapProxy('https://pixiv.cat/143378581.jpg') }
    ];
  }
}
