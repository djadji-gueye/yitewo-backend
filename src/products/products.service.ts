import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) { }

  async create(dto: CreateProductDto, file: Express.Multer.File) {
    const uploadResult: any = await this.cloudinary.uploadImage(file);

    return this.prisma.product.create({
      data: {
        name: dto.name,
        price: Number(dto.price),
        imageUrl: uploadResult.secure_url,
        categoryId: dto.categoryId,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    file?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined;

    if (file) {
      const upload: any = await this.cloudinary.uploadImage(file);
      imageUrl = upload.secure_url;
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.price && { price: Number(dto.price) }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(imageUrl && { imageUrl }),
        updatedAt: new Date(),
      },
    });
  }


  findAll() {
    return this.prisma.product.findMany({ include: { category: true } });
  }
}
