import { Injectable } from '@nestjs/common';

@Injectable()
export class DiscordService {

  /**
   * Obtiene los Top Bots de Discord desde Top.gg
   * Hace scraping del HTML público de top.gg/list/top
   */
  async getTopBots() {
    return this.fetchFromTopGG('top');
  }

  /**
   * Obtiene los Bots Trending de Discord desde Top.gg
   */
  async getTrendingBots() {
    return this.fetchFromTopGG('trending');
  }

  // -------------------------------------------------------------------------
  // 🎮 CANTIDAD DE BOTS A MOSTRAR (MODIFICA AQUÍ)
  // Cambia el '5' por el número de bots que prefieras (ej: 3, 5, 10).
  // -------------------------------------------------------------------------
  private botLimit = 5;
  // -------------------------------------------------------------------------

  private async fetchFromTopGG(listType: string) {
    try {
      const response = await fetch(`https://top.gg/list/${listType}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (!response.ok) {
        console.warn(`Top.gg returned ${response.status}, using fallback data`);
        return this.getFallbackBots();
      }

      const html = await response.text();
      return this.parseTopGGHTML(html);
    } catch (error) {
      console.error('Error fetching Top.gg:', error.message);
      return this.getFallbackBots();
    }
  }

  private parseTopGGHTML(html: string) {
    const bots: any[] = [];

    // Extraer bot entries del HTML usando regex
    // Patron: /bot/ID seguido de nombre y votos
    const botPattern = /href="\/bot\/(\d+)"[^>]*>[\s\S]*?<h5[^>]*>(.*?)<\/h5>/gi;
    const votePattern = /Vote \(([\d.]+[KM]?)\)/gi;
    const descPattern = /<h6[^>]*>(.*?)<\/h6>/gi;

    // Método más robusto: buscar por secciones de bot
    const sections = html.split(/##### /);

    for (let i = 1; i < sections.length && bots.length < this.botLimit; i++) {
      const section = sections[i];

      // Extraer nombre (primera línea después del split)
      const nameMatch = section.match(/^([^\n\r\[]+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();

      // No incluir secciones de navegación o headers
      if (name.length > 50 || name.includes('http') || name.includes('{')) continue;

      // Extraer ID del bot
      const idMatch = section.match(/\/bot\/(\d+)/);
      if (!idMatch) continue;
      const botId = idMatch[1];

      // Extraer votos
      const voteMatch = section.match(/Vote \(([\d.]+[KM]?)\)/);
      const votes = voteMatch ? voteMatch[1] : '0';

      // Extraer descripción
      const descMatch = section.match(/###### ([\s\S]*?)(?:\n|$)/);
      const description = descMatch
        ? descMatch[1].replace(/\[.*?\]\(.*?\)/g, '').trim().slice(0, 80)
        : '';

      // Avatar del bot (Discord CDN)
      const avatarUrl = `https://cdn.discordapp.com/avatars/${botId}`;

      bots.push({
        id: botId,
        name,
        votes,
        description,
        image: this.wrapProxy(`https://top.gg/api/widget/${botId}.png`),
        avatar: avatarUrl,
        url: `https://top.gg/bot/${botId}`
      });
    }

    if (bots.length === 0) {
      return this.getFallbackBots();
    }

    return bots;
  }

  private wrapProxy(url: string): string {
    return `http://192.168.100.15:3000/games/proxy?url=${encodeURIComponent(url)}`;
  }

  private getFallbackBots() {
    return [
      {
        id: '432610292342587392',
        name: 'Mudae',
        votes: '3.26M',
        description: 'Database of 140,000 anime/game characters',
        image: this.wrapProxy('https://top.gg/api/widget/432610292342587392.png'),
        url: 'https://top.gg/bot/432610292342587392'
      },
      {
        id: '646937666251915264',
        name: 'Karuta',
        votes: '1.03M',
        description: '#1 ANIME CARD BOT! Over 170,000 anime cards',
        image: this.wrapProxy('https://top.gg/api/widget/646937666251915264.png'),
        url: 'https://top.gg/bot/646937666251915264'
      },
      {
        id: '408785106942164992',
        name: 'OwO',
        votes: '386K',
        description: 'Keep track of your OwOs and compete globally!',
        image: this.wrapProxy('https://top.gg/api/widget/408785106942164992.png'),
        url: 'https://top.gg/bot/408785106942164992'
      },
      {
        id: '716390085896962058',
        name: 'Pokétwo',
        votes: '381K',
        description: 'The Pokémon experience, on Discord',
        image: this.wrapProxy('https://top.gg/api/widget/716390085896962058.png'),
        url: 'https://top.gg/bot/716390085896962058'
      },
      {
        id: '815289915557675118',
        name: 'Gachapon',
        votes: '376K',
        description: 'Over 30K characters in our Card Game!',
        image: this.wrapProxy('https://top.gg/api/widget/815289915557675118.png'),
        url: 'https://top.gg/bot/815289915557675118'
      },
    ];
  }
}
