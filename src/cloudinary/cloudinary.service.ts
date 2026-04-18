import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
    // uploadImage(file: Express.Multer.File, folder = 'products') {
    //     if (!file || !file.buffer) {
    //         throw new Error('Invalid file');
    //     }

    //     return new Promise((resolve, reject) => {
    //         cloudinary.uploader
    //             .upload_stream(
    //                 { folder, resource_type: 'image' },
    //                 (error, result) => {
    //                     if (error) return reject(error);
    //                     resolve(result);
    //                 },
    //             )
    //             .end(file.buffer);
    //     });
    // }

    uploadImage(file: Express.Multer.File, folder = 'products') {
        if (!file || !file.buffer) throw new Error('Invalid file');
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'image',
                    // Optimisations quota : resize + qualité auto
                    transformation: [
                        { width: 1200, crop: 'limit' },   // jamais plus de 1200px
                        { quality: 'auto:good' },          // qualité optimale Cloudinary
                        { fetch_format: 'auto' },          // webp si supporté
                    ],
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                },
            ).end(file.buffer);
        });
    }

}
