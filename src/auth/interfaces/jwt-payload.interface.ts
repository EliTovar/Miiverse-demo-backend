/* eslint-disable prettier/prettier */

import { Role } from "../constants/roles.enum";

export interface JwtPayload {
  sub: number;
  username: string;
  role: Role;
}