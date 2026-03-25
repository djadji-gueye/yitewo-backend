import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ── Login ────────────────────────────────────
  async login(dto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (!admin) throw new UnauthorizedException('Email ou mot de passe incorrect');

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Email ou mot de passe incorrect');

    const token = this.jwt.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });

    return {
      accessToken: token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  // ── Me (profil courant) ──────────────────────
  async me(adminId: string) {
    return this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  // ── Créer un admin (super_admin seulement) ───
  async createAdmin(dto: CreateAdminDto) {
    const exists = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email déjà utilisé');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const admin = await this.prisma.admin.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name ?? 'Admin',
        role: dto.role ?? 'ADMIN',
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return admin;
  }

  // ── Lister les admins ────────────────────────
  listAdmins() {
    return this.prisma.admin.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Changer mot de passe ─────────────────────
  async changePassword(
    adminId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new UnauthorizedException();

    const valid = await bcrypt.compare(oldPassword, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Ancien mot de passe incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { passwordHash },
    });

    return { ok: true, message: 'Mot de passe mis à jour' };
  }

  // ── Seed: créer le premier super admin ───────
  async seedSuperAdmin(email: string, password: string) {
    const count = await this.prisma.admin.count();
    if (count > 0) {
      return { message: 'Des admins existent déjà' };
    }
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.admin.create({
      data: {
        email,
        passwordHash,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
      },
      select: { id: true, email: true, name: true, role: true },
    });
  }
}
