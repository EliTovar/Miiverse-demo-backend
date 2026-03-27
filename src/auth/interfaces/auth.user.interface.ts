import { Role } from '../constants/roles.enum';

export interface AuthUser {
  userId: number;
  username: string;
  role: Role;
}
