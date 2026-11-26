import { BadRequestException } from '@nestjs/common';
import { avatarFor, toModerationFilters, toPageQuery, toTimeZone } from './miiverse-query.parsers';

describe('toPageQuery', () => {
  it('usa página 1, límite 20 y orden recent por defecto', () => {
    expect(toPageQuery()).toEqual({ page: 1, limit: 20, sort: 'recent' });
  });

  it('acota el límite entre 1 y 50 y la página a >= 1', () => {
    expect(toPageQuery('0', '500')).toEqual({ page: 1, limit: 50, sort: 'recent' });
    expect(toPageQuery('-3', '-1')).toEqual({ page: 1, limit: 1, sort: 'recent' });
    expect(toPageQuery('2.7', '10.9', 'popular')).toEqual({ page: 2, limit: 10, sort: 'popular' });
  });

  it('ignora valores no numéricos y órdenes desconocidos', () => {
    expect(toPageQuery('abc', 'xyz', 'DROP TABLE')).toEqual({ page: 1, limit: 20, sort: 'recent' });
  });
});

describe('toTimeZone', () => {
  it('usa UTC si no se envía', () => {
    expect(toTimeZone()).toBe('UTC');
    expect(toTimeZone('  ')).toBe('UTC');
  });

  it('acepta zonas IANA válidas', () => {
    expect(toTimeZone('America/Mexico_City')).toBe('America/Mexico_City');
  });

  it('responde 400 con una zona que no existe', () => {
    expect(() => toTimeZone('Marte/Olympus')).toThrow(BadRequestException);
  });
});

describe('toModerationFilters', () => {
  it('limpia espacios y deja vacíos como undefined', () => {
    expect(toModerationFilters({ q: '  hola ', user: '', community: ' Zelda ' })).toEqual({
      kind: 'all',
      text: 'hola',
      username: undefined,
      community: 'Zelda',
      timeZone: 'UTC',
      date: undefined,
      month: undefined,
      hour: undefined,
    });
  });

  it('acepta fecha, mes y hora válidos', () => {
    const f = toModerationFilters({ type: 'comment', date: '2026-11-25', month: '2026-11', hour: '0' });
    expect(f).toMatchObject({ kind: 'comment', date: '2026-11-25', month: '2026-11', hour: 0 });
  });

  it.each([
    [{ type: 'user' }],
    [{ date: '25/11/2026' }],
    [{ month: '2026-13' }],
    [{ hour: '24' }],
    [{ hour: '1.5' }],
    [{ tz: 'No/Existe' }],
  ])('responde 400 con %j', (q) => {
    expect(() => toModerationFilters(q)).toThrow(BadRequestException);
  });
});

describe('avatarFor', () => {
  it('codifica el nombre en la URL', () => {
    expect(avatarFor('a b&c')).toContain('name=a%20b%26c');
  });
});
