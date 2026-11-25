import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;

  async onModuleInit(): Promise<void> {
    // Credenciales desde .env (ver .env.example). Solo la contraseña es obligatoria.
    if (!process.env.DB_PASSWORD) {
      throw new Error('Falta DB_PASSWORD en el archivo .env (ver .env.example)');
    }
    this.pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME ?? 'SocialMedia',
    });

    await this.pool.query('SELECT 1');
    console.log('🟢 PostgreSQL conectado');
    await this.createSchema();
  }

  private async createSchema() {
    // La tabla users se crea aquí para que una base de datos vacía funcione.
    // IF NOT EXISTS: no toca una tabla users que ya exista.
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        username      VARCHAR(100) NOT NULL,
        email         VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          VARCHAR(20) NOT NULL DEFAULT 'user',
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS pos_x float8 DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pos_y float8 DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pos_z float8 DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rot_y float8 DEFAULT 0;
    `;
    await this.pool.query(query);
    console.log('🛠️ Schema de persistencia verificado/actualizado');
  }

  async query<T = any>(text: string, params: any[] = []): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows as T[];
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
