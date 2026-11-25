/* eslint-disable prettier/prettier */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthRequiredGuard } from 'src/auth/guards/auth-required.guard';
import type { AuthUser } from 'src/auth/interfaces/auth.user.interface';
import { CurrentUser } from 'src/auth/decorator/current.decorator';

@Controller('users')
export class UsersController {
  @UseGuards(AuthRequiredGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}

//Si mañana quieres solo el userId: @CurrentUser('id') id: number