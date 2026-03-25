import { MulterModuleOptions } from '@nestjs/platform-express';
import { BadRequestException } from '@nestjs/common';

export const multerConfig: MulterModuleOptions = {
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
            return cb(
                new BadRequestException('Seules les images sont autorisées'),
                false
            );
        }
        cb(null, true);
    },
};
