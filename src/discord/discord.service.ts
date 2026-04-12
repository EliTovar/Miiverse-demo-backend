import { Injectable } from '@nestjs/common';

@Injectable()
export class DiscordService {

  /**
   * Obtiene los Top Servidores de Discord desde Top.gg
   */
  async getTopBots() {
    return this.fetchFromTopGG('list/top');
  }

  /**
   * Obtiene los Servidores Trending de Discord desde Top.gg
   */
  async getTrendingBots() {
    return this.fetchFromTopGG('list/trending');
  }

  // -------------------------------------------------------------------------
  // 🎮 CANTIDAD DE BOTS A MOSTRAR (MODIFICA AQUÍ)
  // Cambia el '5' por el número de bots que prefieras (ej: 3, 5, 10).
  // -------------------------------------------------------------------------
  private botLimit = 5;
  // -------------------------------------------------------------------------

  private async fetchFromTopGG(listType: string) {
    try {
      const response = await fetch(`https://top.gg/discord/servers/${listType}`, {
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
    const servers: any[] = [];

    // Dividimos por el prefijo de las URLs de los servidores
    const sections = html.split(/href="\/discord\/servers\/(\d+)"/);

    for (let i = 1; i < sections.length && servers.length < this.botLimit; i += 2) {
      const serverId = sections[i];
      const htmlContent = sections[i + 1].substring(0, 3000); // Rango de busqueda razonable

      // Si ya agregamos este servidor, saltar (top.gg suele repetir links)
      if (servers.find(s => s.id === serverId)) continue;

      // Buscar <img alt="Nombre Servidor" ... src="Url Imagen">
      const imgMatch = htmlContent.match(/<img[^>]*alt="([^"]+)"[^>]*src="([^"]+)"/i);
      
      // La imagen a veces tiene class antes que src, o viceversa, pero lo anterior cubre la mayoría
      // Alternativa más segura:
      const rawImgMatch = htmlContent.match(/<img[^>]+>/i);
      let name = 'Discord Server';
      let imageStr = '';
      
      if (rawImgMatch) {
         const altM = rawImgMatch[0].match(/alt="([^"]+)"/i);
         if (altM) name = altM[1].replace(/&amp;/g, '&');
         
         const srcM = rawImgMatch[0].match(/src="([^"]+)"/i);
         if (srcM) imageStr = srcM[1];
      }

      // Buscar los votos, usando Vote (XX)
      const voteMatch = htmlContent.match(/Vote \(([\d.]+[KM]?)\)/i);
      const votes = voteMatch ? voteMatch[1] : '0';

      if (serverId && imageStr && !imageStr.includes('lazyload')) {
        servers.push({
          id: serverId,
          name: name,
          votes: votes,
          description: name, // En top.gg servidores el alt de la imagen tiene el nombre+descripción corta
          image: this.wrapProxy(imageStr),
          url: `https://top.gg/discord/servers/${serverId}`
        });
      }
    }

    if (servers.length === 0) {
      return this.getFallbackBots();
    }

    return servers;
  }

  private wrapProxy(url: string): string {
    return `http://192.168.100.15:3000/games/proxy?url=${encodeURIComponent(url)}`;
  }

  private getFallbackBots() {
    return [
      {
        id: '543765059424428035',
        name: 'VALORANT',
        votes: '7K',
        description: 'The official VALORANT Discord server',
        image: this.wrapProxy('https://cdn.top.gg/icons/543765059424428035/95633b49ee9bdf4ecae7df8df08cdfa4.webp?size=128'),
        url: 'https://top.gg/discord/servers/543765059424428035'
      },
      {
        id: '542884599173636104',
        name: 'Roblox',
        votes: '23K',
        description: 'The largest community-run Roblox Discord',
        image: this.wrapProxy('https://cdn.top.gg/icons/542884599173636104/a_fe23a6c2bb20d75cda6d9cedda7da729.webp?size=128'),
        url: 'https://top.gg/discord/servers/542884599173636104'
      },
      {
        id: '703564803452985344',
        name: 'Socialize',
        votes: '8K',
        description: 'The most active VC server!',
        image: this.wrapProxy('https://cdn.top.gg/icons/703564803452985344/a_6a6206d95392fe19fae21f1d11b33ed5.webp?size=128'),
        url: 'https://top.gg/discord/servers/703564803452985344'
      },
      {
        id: '542882462976860160',
        name: 'Study Together',
        votes: '5K',
        description: 'Find your study flow on the largest global student community',
        image: this.wrapProxy('https://cdn.top.gg/icons/542882462976860160/a_65a7ba3daeb9eaeb7ff05bda6bdfe42a.webp?size=128'),
        url: 'https://top.gg/discord/servers/542882462976860160'
      },
      {
        id: '542872912039141380',
        name: 'Dadscord',
        votes: '3K',
        description: 'Most Active VC Server For Everyone',
        image: this.wrapProxy('https://cdn.top.gg/icons/542872912039141380/a_76e5dd2c505bedae3369a19c9629b35e.webp?size=128'),
        url: 'https://top.gg/discord/servers/542872912039141380'
      },
    ];
  }
}
