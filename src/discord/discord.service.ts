import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Formato que consume el frontend (DiscordBot en DiscordService del frontend). */
export interface DiscordServerItem {
  id: string;
  name: string;
  votes: string; // se mantiene el nombre por compatibilidad: ahora son los miembros
  members: number;
  online: number;
  description: string;
  image: string;
  url: string;
}

/**
 * Servidores de Discord más populares, con datos en vivo.
 *
 * Antes se hacía scraping de Top.gg, pero Top.gg bloquea a propósito las
 * peticiones automáticas (403) y su API oficial no lista servidores.
 *
 * Ahora se usa la API pública de invitaciones de Discord
 * (`GET /invites/{code}?with_counts=true`), que no necesita token y devuelve
 * el número de miembros y de personas en línea de cada servidor.
 *
 * Limitación: Discord no publica un ranking global. Por eso consultamos una lista
 * de servidores públicos grandes (CANDIDATE_INVITES) y los ordenamos con sus datos
 * en vivo. Los números son reales; la lista de candidatos la elegimos nosotros.
 */
@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  // -------------------------------------------------------------------------
  // 🎮 SERVIDORES CANDIDATOS (MODIFICA AQUÍ)
  // Códigos de invitación "vanity" (discord.gg/<código>) de servidores públicos.
  // Máximo ~15: Discord limita las peticiones seguidas a este endpoint (429).
  // -------------------------------------------------------------------------
  private readonly CANDIDATE_INVITES = [
    'midjourney', 'minecraft', 'marvelrivals', 'valorant', 'genshinimpact',
    'fortnite', 'honkaistarrail', 'wutheringwaves', 'zenlesszonezero',
    'rocketleague', 'lofigirl', 'apexlegends', 'openai', 'overwatch', 'terraria',
  ];
  private readonly serverLimit = 5;
  // -------------------------------------------------------------------------

  private readonly CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 hora
  private cache: { data: DiscordServerItem[]; time: number } | null = null;

  constructor(private configService: ConfigService) {}

  /** Top por número de miembros. */
  async getTopBots(): Promise<DiscordServerItem[]> {
    const servers = await this.getServers();
    return [...servers].sort((a, b) => b.members - a.members).slice(0, this.serverLimit);
  }

  /** "Trending": los que tienen más gente en línea ahora mismo. */
  async getTrendingBots(): Promise<DiscordServerItem[]> {
    const servers = await this.getServers();
    return [...servers].sort((a, b) => b.online - a.online).slice(0, this.serverLimit);
  }

  private async getServers(): Promise<DiscordServerItem[]> {
    if (this.cache && Date.now() - this.cache.time < this.CACHE_DURATION) {
      return this.cache.data;
    }

    this.logger.log('🌐 Consultando servidores en la API de invitaciones de Discord...');
    const servers: DiscordServerItem[] = [];

    // En serie (no en paralelo) para no disparar el límite de peticiones de Discord.
    for (const code of this.CANDIDATE_INVITES) {
      const server = await this.fetchInvite(code);
      if (server) servers.push(server);
    }

    if (servers.length === 0) {
      // Sin datos nuevos: devolvemos lo último que funcionó (aunque esté caducado).
      return this.cache?.data ?? [];
    }

    this.cache = { data: servers, time: Date.now() };
    return servers;
  }

  private async fetchInvite(code: string): Promise<DiscordServerItem | null> {
    try {
      const res = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        // 404 = invitación caducada; 429 = demasiadas peticiones.
        this.logger.warn(`Discord invite "${code}" respondió ${res.status}`);
        return null;
      }

      const json = await res.json();
      const guild = json.guild;
      if (!guild?.id) return null;

      const members: number = json.approximate_member_count ?? 0;
      const online: number = json.approximate_presence_count ?? 0;
      const icon = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';

      return {
        id: guild.id,
        name: guild.name,
        votes: this.formatCount(members),
        members,
        online,
        description: `${this.formatCount(members)} miembros · ${this.formatCount(online)} en línea`,
        image: this.wrapProxy(icon),
        url: `https://discord.gg/${code}`,
      };
    } catch (e) {
      this.logger.warn(`Error consultando la invitación "${code}": ${(e as Error).message}`);
      return null;
    }
  }

  /** 4308826 → "4.3M", 409349 → "409K". */
  private formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
  }

  private wrapProxy(url: string): string {
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
    return `${baseUrl}/games/proxy?url=${encodeURIComponent(url)}`;
  }
}
