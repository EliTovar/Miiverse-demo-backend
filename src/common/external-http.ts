import { ConfigService } from '@nestjs/config';

/*
 * Utilidades compartidas por los servicios que leen tendencias de sitios
 * externos (Steam, Discord, Kworb, AniList, Pixiv).
 */

/** Tiempo máximo de espera de una petición externa. */
export const EXTERNAL_TIMEOUT_MS = 8000;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
];

/** Un User-Agent de navegador real al azar (algunos sitios bloquean a los bots). */
export function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * URL de una imagen externa pasada por nuestro proxy (/games/proxy), para que
 * el navegador pueda usarla como textura sin problemas de CORS.
 */
export function proxyImageUrl(config: ConfigService, url: string): string {
  const baseUrl = config.get<string>('BASE_URL') || 'http://localhost:3000';
  return `${baseUrl}/games/proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Caché en memoria de un solo valor con caducidad.
 * - `fresh`: el valor si todavía no caducó.
 * - `last`: el último valor guardado aunque haya caducado (para usarlo si el
 *   sitio externo falla).
 */
export class TtlCache<T> {
  private entry: { value: T; time: number } | null = null;

  constructor(private readonly ttlMs: number) {}

  get fresh(): T | undefined {
    if (this.entry && Date.now() - this.entry.time < this.ttlMs) {
      return this.entry.value;
    }
    return undefined;
  }

  get last(): T | undefined {
    return this.entry?.value;
  }

  set(value: T): void {
    this.entry = { value, time: Date.now() };
  }
}
