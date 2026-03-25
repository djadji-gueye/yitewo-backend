import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
    uploadImage(file: Express.Multer.File, folder = 'products') {
        if (!file || !file.buffer) {
            throw new Error('Invalid file');
        }

        return new Promise((resolve, reject) => {
            cloudinary.uploader
                .upload_stream(
                    { folder, resource_type: 'image' },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    },
                )
                .end(file.buffer);
        });
    }

}
