import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** Panel de administración: rutas /admin (solo rol admin). */
@Module({
  imports: [DatabaseModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
