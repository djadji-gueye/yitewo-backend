// ═══════════════════════════════════════════════════════
// src/upload/upload.controller.ts
// Endpoint universel d'upload vers Cloudinary
// ═══════════════════════════════════════════════════════

import {
  Controller, Post, UploadedFile,
  UseInterceptors, Body, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { multerConfig } from '../common/multer.config';

@Controller('upload')
export class UploadController {
  constructor(private readonly cloudinary: CloudinaryService) { }

  // ── Upload authentifié par token partenaire ──────────
  // Utilisé par : profil photo, bannière, produits
  @Post('partner')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadPartner(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder: string = 'products',
    @Body('token') token: string,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');

    // Dossiers autorisés — évite les abus
    const allowed = ['products', 'partners', 'banners', 'opportunities'];
    const safeFolder = allowed.includes(folder) ? folder : 'products';

    const result: any = await this.cloudinary.uploadImage(file, `yitewo/${safeFolder}`);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }

  // ── Upload public (opportunités, annonces) ───────────
  @Post('public')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadPublic(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder: string = 'opportunities',
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    const result: any = await this.cloudinary.uploadImage(file, 'yitewo/opportunities');
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }
}