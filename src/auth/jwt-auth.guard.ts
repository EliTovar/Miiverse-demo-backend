/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// Este guard le dice a Nest: “Antes de entrar a la ruta, valida el JWT”

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err, user) {
        // No token = gues (permitido)
        if (err) throw err;
        return user ?? null;
    }
}
