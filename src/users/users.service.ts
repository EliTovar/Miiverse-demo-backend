import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async createUser(username: string, email: string, password: string) {
    // 🔐 Hashear password
    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await this.db.query<{
      id: number;
      username: string;
      email: string;
    }>(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [username, email, passwordHash],
    );

    return user;
  }

  async findAll() {
    return this.db.query('SELECT id, username, email, created_at FROM users');
  }
}
