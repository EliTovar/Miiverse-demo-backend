import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MalService {
  private readonly logger = new Logger(MalService.name);
  private readonly jikanUrl = 'https://api.jikan.moe/v4';

  private wrapProxy(url: string): string {
    return `http://192.168.100.15:3000/games/proxy?url=${encodeURIComponent(url)}`;
  }

  async getTopAnime() {
    try {
      const res = await fetch(`${this.jikanUrl}/top/anime?limit=5`);
      const data = await res.json();
      
      return data.data.map((item, index) => ({
        appid: 6000 + index,
        name: item.title,
        author: item.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author',
        image: this.wrapProxy(item.images.jpg.large_image_url)
      }));
    } catch (e) {
      this.logger.error('❌ Error fetching Top Anime from Jikan', e);
      return [];
    }
  }

  async getTopManga() {
    try {
      const res = await fetch(`${this.jikanUrl}/top/manga?limit=5`);
      const data = await res.json();
      
      return data.data.map((item, index) => ({
        appid: 7000 + index,
        name: item.title,
        author: item.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author',
        image: this.wrapProxy(item.images.jpg.large_image_url)
      }));
    } catch (e) {
      this.logger.error('❌ Error fetching Top Manga from Jikan', e);
      return [];
    }
  }
}
