/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */

//Genera y valida tokens
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from 'src/database/database.service';
import { UserWithPassword } from './interfaces/user-with-password.interface';
import { RegisterDto } from 'src/users/dto/register-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) { //! Login
    const users = await this.db.query<UserWithPassword>
    (`SELECT id, username, email, password_hash, role FROM users WHERE email = $1`, [email]);

    const user = users[0];

    if (!user) {
        throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(
        password, 
        user.password_hash,
    );

    if(!passwordValid) {
        throw new UnauthorizedException('Creadenciales inválidas');
    }

    const payload = {
        sub: user.id,
        username: user.username,
        role: user.role,
    };

    return {
        access_token: this.jwtService.sign(payload),
    };
  } 

  async register(dto: RegisterDto) {
  // 0. Validar los datos mínimos (no hay ValidationPipe en el proyecto)
  const username = typeof dto?.username === 'string' ? dto.username.trim() : '';
  const email = typeof dto?.email === 'string' ? dto.email.trim() : '';
  const password = typeof dto?.password === 'string' ? dto.password : '';

  if (!username || !email || !password) {
    throw new BadRequestException('Usuario, email y contraseña son obligatorios');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('El email no es válido');
  }
  if (password.length < 6) {
    throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
  }

  // 1. Verificar email existente
  const existing = await this.db.query<{ id: number }>(
    'SELECT id FROM users WHERE email = $1',
    [email],
  );

  if (existing.length > 0) {
    throw new ConflictException('El email ya está registrado');
  }

  // 2. Hashear password ✅
  const hashedPassword = await bcrypt.hash(password, 10);

  // 3. Insertar usuario
  const users = await this.db.query<{
    id: number;
    username: string;
    email: string;
    role: string;
  }>(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, role`,
    [username, email, hashedPassword],
  );

  return users[0];
}

  
}
