/* eslint-disable prettier/prettier */
import { Body, Controller, Post, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './interfaces/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from 'src/users/dto/register-user.dto';

interface UserPayload {
  id: string;
  email: string;
  [key: string]: any;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService
  ) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Req() req: Request & { user: UserPayload }): UserPayload {
    return req.user;
  }
}
