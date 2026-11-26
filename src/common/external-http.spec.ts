import { ConfigService } from '@nestjs/config';
import { TtlCache, proxyImageUrl } from './external-http';

describe('TtlCache', () => {
  afterEach(() => jest.useRealTimers());

  it('empieza vacía', () => {
    const cache = new TtlCache<number>(1000);
    expect(cache.fresh).toBeUndefined();
    expect(cache.last).toBeUndefined();
  });

  it('devuelve el valor mientras no caduca y lo conserva como `last` después', () => {
    jest.useFakeTimers();
    const cache = new TtlCache<string>(1000);
    cache.set('a');
    expect(cache.fresh).toBe('a');

    jest.advanceTimersByTime(1000);
    expect(cache.fresh).toBeUndefined();
    expect(cache.last).toBe('a');
  });
});

describe('proxyImageUrl', () => {
  const config = (baseUrl?: string) =>
    ({ get: () => baseUrl }) as unknown as ConfigService;

  it('usa BASE_URL y codifica la URL original', () => {
    expect(
      proxyImageUrl(config('http://192.168.1.5:3000'), 'https://x.com/a b.png'),
    ).toBe(
      'http://192.168.1.5:3000/games/proxy?url=https%3A%2F%2Fx.com%2Fa%20b.png',
    );
  });

  it('sin BASE_URL usa localhost:3000', () => {
    expect(proxyImageUrl(config(), 'https://x.com/a.png')).toMatch(
      /^http:\/\/localhost:3000\/games\/proxy\?url=/,
    );
  });
});
