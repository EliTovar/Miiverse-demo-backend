import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard para las rutas que SÍ requieren sesión.
 *
 * El guard global (JwtAuthGuard) deja pasar a los invitados (user = null).
 * Este guard usa el comportamiento por defecto de Passport: si no hay token,
 * o es inválido o ha caducado, responde 401 Unauthorized.
 *
 * Uso: @UseGuards(AuthRequiredGuard) en la ruta.
 */
@Injectable()
export class AuthRequiredGuard extends AuthGuard('jwt') {}
