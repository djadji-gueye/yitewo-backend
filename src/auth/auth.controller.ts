import {
  Controller, Post, Get, Body, Patch,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { IsString, MinLength } from 'class-validator';

class ChangePasswordDto {
  @IsString() oldPassword: string;
  @IsString() @MinLength(6) newPassword: string;
}

class SeedDto {
  @IsString() email: string;
  @IsString() @MinLength(6) password: string;
  @IsString() secret: string;  // clé de sécurité pour éviter les abus
}

@Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}

  // ── Login public ─────────────────────────────
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  // ── Profil (protégé) ─────────────────────────
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return this.service.me(user.id);
  }

  // ── Changer mot de passe (protégé) ───────────
  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: any,
    @Body() body: ChangePasswordDto,
  ) {
    return this.service.changePassword(
      user.id,
      body.oldPassword,
      body.newPassword,
    );
  }

  // ── Créer admin (super_admin seulement) ──────
  @Post('admins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.service.createAdmin(dto);
  }

  // ── Lister admins (super_admin) ──────────────
  @Get('admins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  listAdmins() {
    return this.service.listAdmins();
  }

  // ── Setup initial (premier lancement) ────────
  // À appeler UNE seule fois pour créer le super admin
  // Protégé par une clé secrète dans le body
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  setup(@Body() body: SeedDto) {
    const SETUP_SECRET = process.env.SETUP_SECRET || 'lepfila_setup_2024';
    if (body.secret !== SETUP_SECRET) {
      return { error: 'Clé invalide' };
    }
    return this.service.seedSuperAdmin(body.email, body.password);
  }
}
