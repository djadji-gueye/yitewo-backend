
import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
    imports: [CloudinaryModule],
    controllers: [UploadController],
})
export class UploadModule { }


// ═══════════════════════════════════════════════════════
// src/cloudinary/cloudinary.module.ts — s'il n'existe pas
// ═══════════════════════════════════════════════════════

// import { Module } from '@nestjs/common';
// import { CloudinaryProvider } from './cloudinary.provider';
// import { CloudinaryService } from './cloudinary.service';
//
// @Module({
//   providers: [CloudinaryProvider, CloudinaryService],
//   exports: [CloudinaryService],
// })
// export class CloudinaryModule {}


// ═══════════════════════════════════════════════════════
// src/app.module.ts — ajouter UploadModule dans imports
// ═══════════════════════════════════════════════════════

// imports: [
//   ...autres modules,
//   UploadModule,   // ← ajouter
// ]


// ═══════════════════════════════════════════════════════
// src/cloudinary/cloudinary.service.ts — version améliorée
// Ajoute les options d'optimisation pour économiser le quota
// ═══════════════════════════════════════════════════════

// uploadImage(file: Express.Multer.File, folder = 'products') {
//   if (!file || !file.buffer) throw new Error('Invalid file');
//   return new Promise((resolve, reject) => {
//     cloudinary.uploader.upload_stream(
//       {
//         folder,
//         resource_type: 'image',
//         // Optimisations quota : resize + qualité auto
//         transformation: [
//           { width: 1200, crop: 'limit' },   // jamais plus de 1200px
//           { quality: 'auto:good' },          // qualité optimale Cloudinary
//           { fetch_format: 'auto' },          // webp si supporté
//         ],
//       },
//       (error, result) => {
//         if (error) return reject(error);
//         resolve(result);
//       },
//     ).end(file.buffer);
//   });
// }
