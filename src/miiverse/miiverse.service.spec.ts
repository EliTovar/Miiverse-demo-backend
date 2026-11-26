import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MiiverseService } from './miiverse.service';
import { DatabaseService } from '../database/database.service';

/**
 * Pruebas de las reglas del servicio que no dependen de PostgreSQL: validación
 * de entradas y permisos. La BD es falsa y responde según la consulta.
 * (Las consultas SQL se probaron contra la BD real en transacciones con ROLLBACK.)
 */
type Handler = (sql: string, params: unknown[]) => unknown[];

function makeService(handler: Handler = () => []) {
  const query = jest.fn((sql: string, params: unknown[] = []) => Promise.resolve(handler(sql, params)));
  const service = new MiiverseService({ query } as unknown as DatabaseService);
  return { service, query };
}

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const post = { id: 1, username: 'autor', comments_count: 0 };

describe('MiiverseService · publicar', () => {
  it.each([
    [{}, 'La publicación necesita texto o un dibujo'],
    [{ content_text: '   ' }, 'La publicación necesita texto o un dibujo'],
    [{ content_text: 'a'.repeat(501) }, 'El texto no puede pasar de 500 caracteres'],
    [{ content_text: 123 }, 'El texto debe ser texto'],
    [{ drawing_url: 'https://otra-web.com/a.png' }, 'El dibujo debe ser una imagen PNG o JPEG generada en la app'],
    [{ content_text: 'hola', game_title: 'g'.repeat(201) }, 'La comunidad no puede pasar de 200 caracteres'],
  ])('rechaza %j con 400', async (dto, message) => {
    const { service, query } = makeService();
    await expect(service.createPost(dto as never, 1, 'u', 'a')).rejects.toThrow(new BadRequestException(message));
    expect(query).not.toHaveBeenCalled();
  });

  it('acepta texto o dibujo y limpia espacios', async () => {
    const { service, query } = makeService(() => [{ id: 9 }]);
    await service.createPost({ content_text: '  hola  ', drawing_url: PNG, game_title: ' Splatoon 3 ' }, 1, 'u', 'a');
    const params = query.mock.calls[0][1] ?? [];
    expect(params.slice(3)).toEqual(['hola', PNG, null, 'Splatoon 3', false]);
  });
});

describe('MiiverseService · Yeah a un post', () => {
  it('responde 404 si el post no existe (antes daba error 500)', async () => {
    const { service } = makeService(() => []);
    await expect(service.toggleYeah(999, 1)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MiiverseService · comentarios', () => {
  const comment = { id: 5, post_id: 1, user_id: 10, is_spoiler: false, yeahs: 0, yeahed: false };
  const handler: Handler = sql => {
    if (sql.includes('FROM miiverse_comments c WHERE id')) return [comment];
    if (sql.includes('FROM miiverse_posts p WHERE id')) return [post];
    return [{ id: 5 }];
  };

  it('no deja comentar vacío ni más de 500 caracteres', async () => {
    const { service } = makeService(handler);
    await expect(service.createComment(1, { content_text: ' ' }, 1, 'u', 'a')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createComment(1, { content_text: 'a'.repeat(501) }, 1, 'u', 'a')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('solo el autor puede editar', async () => {
    const { service } = makeService(handler);
    await expect(service.updateComment(5, { content_text: 'x' }, 99)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.updateComment(5, { content_text: 'x' }, 10)).resolves.toEqual(comment);
  });

  it('borrar: el autor o un admin, nadie más', async () => {
    const { service } = makeService(handler);
    await expect(service.deleteComment(5, 99, false)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteComment(5, 99, true)).resolves.toEqual({ id: 5, post_id: 1 });
    await expect(service.deleteComment(5, 10, false)).resolves.toEqual({ id: 5, post_id: 1 });
  });
});
