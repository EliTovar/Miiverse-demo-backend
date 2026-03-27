import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: '123', // 👈 tu password real
      database: 'SocialMedia',
    });

    await this.pool.query('SELECT 1');
    console.log('🟢 PostgreSQL conectado');
  }

  async query<T = any>(text: string, params: any[] = []): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows as T[];
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
