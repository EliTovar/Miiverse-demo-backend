import { Injectable } from '@nestjs/common';

@Injectable()
export class GamesService {
  async getTrendingGames() {
    try {
      const response = await fetch('https://steamspy.com/api.php?request=top100in2weeks');
      const data = await response.json();
      
      // Convertir el objeto de SteamSpy en un array ordenado por jugadores concurrentes (CCU)
      const gamesArray = Object.values(data) as any[];
      const sorted = gamesArray.sort((a, b) => (b.ccu || 0) - (a.ccu || 0));
      
      // Extraer los top 3 reales
      const trending = sorted.slice(0, 3).map(game => ({
        appid: game.appid,
        name: game.name,
        // 🔥 Cambiamos a la imagen de la biblioteca que es vertical y tipo "Icono"
        image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900_2x.jpg`
      }));

      return trending;
    } catch (error) {
      console.error('Error fetching SteamSpy:', error.message);
      return [];
    }
  }
}
