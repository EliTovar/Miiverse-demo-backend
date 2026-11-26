import { UsersController } from './users.controller';
import { Role } from '../auth/constants/roles.enum';

describe('UsersController', () => {
  it('GET /users/profile devuelve el usuario del token', () => {
    const controller = new UsersController();
    const user = { id: 7, username: 'mii', role: Role.USER };
    expect(controller.getProfile(user)).toEqual(user);
  });
});
