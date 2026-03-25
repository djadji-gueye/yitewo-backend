import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) { }

  create(name: string) {
    console.log("categories")
    return this.prisma.category.create({ data: { name } });
  }

  findAll() {
    return this.prisma.category.findMany();
  }
}
