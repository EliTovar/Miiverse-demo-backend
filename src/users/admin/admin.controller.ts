/* eslint-disable prettier/prettier */

import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from "@nestjs/common";
import { Role } from "src/auth/constants/roles.enum";
import { Roles } from "src/auth/decorator/roles.decorator";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { CurrentUser } from "src/auth/decorator/current.decorator";
import type { AuthUser } from "src/auth/interfaces/auth.user.interface";
import { AdminService } from "./admin.service";

/**
 * Panel de administración. Todas las rutas exigen rol admin: el RolesGuard
 * responde 403 a invitados y a usuarios normales.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get('dashboard')
    getDashboard() {
        return {
            message: 'Bienvenido admin 👑'
        };
    }

    /** Cifras generales (usuarios, posts, comentarios, últimos 7 días). */
    @Get('stats')
    getStats() {
        return this.adminService.getStats();
    }

    /** Usuarios registrados con su actividad. `q` busca en nombre o email. */
    @Get('users')
    listUsers(
        @Query('q') q?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const pageNum = Math.max(1, Math.floor(Number(page)) || 1);
        const limitNum = Math.min(50, Math.max(1, Math.floor(Number(limit)) || 20));
        return this.adminService.listUsers(q, pageNum, limitNum);
    }

    /** Cambiar el rol de un usuario. Body: { role: 'user' | 'admin' }. */
    @Patch('users/:id/role')
    setRole(
        @Param('id', ParseIntPipe) id: number,
        @Body('role') role: unknown,
        @CurrentUser() admin: AuthUser,
    ) {
        return this.adminService.setRole(id, role, admin.id);
    }
}
