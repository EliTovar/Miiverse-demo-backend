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

  async findById(id: number) {
    const [user] = await this.db.query<{
      id: number;
      username: string;
      email: string;
      pos_x: number;
      pos_y: number;
      pos_z: number;
      rot_y: number;
    }>(
      'SELECT id, username, email, pos_x, pos_y, pos_z, rot_y FROM users WHERE id = $1',
      [id],
    );
    return user;
  }

  async updatePosition(
    id: number,
    pos: { x: number; y: number; z: number },
    rot: { y: number },
  ) {
    await this.db.query(
      `UPDATE users 
       SET pos_x = $1, pos_y = $2, pos_z = $3, rot_y = $4 
       WHERE id = $5`,
      [pos.x, pos.y, pos.z, rot.y, id],
    );
  }

  async findAll() {
    return this.db.query(
      'SELECT id, username, email, pos_x, pos_y, pos_z, rot_y, created_at FROM users',
    );
  }
}
