import { Role } from '../constants/roles.enum';

export interface AuthUser {
  id: number; // JwtStrategy.validate() devuelve `id` (antes `userId`)
  username: string;
  role: Role;
}
