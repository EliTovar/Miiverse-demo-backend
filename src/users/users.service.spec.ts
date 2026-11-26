import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';

/** BD falsa: guarda la última consulta y devuelve lo que le digamos. */
function fakeDb(rows: unknown[] = []) {
  const query = jest.fn().mockResolvedValue(rows);
  return { db: { query } as unknown as DatabaseService, query };
}

describe('UsersService', () => {
  it('createUser guarda la contraseña hasheada, nunca en texto plano', async () => {
    const { db, query } = fakeDb([{ id: 1, username: 'mii', email: 'mii@test.com' }]);
    const service = new UsersService(db);

    const user = await service.createUser('mii', 'mii@test.com', 'secreta123');

    const [, params] = query.mock.calls[0] as [string, string[]];
    const storedHash = params[2];
    expect(storedHash).not.toBe('secreta123');
    await expect(bcrypt.compare('secreta123', storedHash)).resolves.toBe(true);
    expect(user).toEqual({ id: 1, username: 'mii', email: 'mii@test.com' });
  });

  it('findById consulta por id con parámetro (sin concatenar SQL)', async () => {
    const { db, query } = fakeDb([{ id: 3, username: 'eli' }]);
    const service = new UsersService(db);

    await expect(service.findById(3)).resolves.toEqual({ id: 3, username: 'eli' });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), [3]);
  });
});
