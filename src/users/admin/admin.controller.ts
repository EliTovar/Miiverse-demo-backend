/* eslint-disable prettier/prettier */

import { Controller, Get, UseGuards } from "@nestjs/common";
import { Role } from "src/auth/constants/roles.enum";
import { Roles } from "src/auth/decorator/roles.decorator";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
    @Get('dashboard')
    @Roles(Role.ADMIN)
    getDashboard() {
        return {
            message: 'Bienvenido admin 👑'
        };
    }
}