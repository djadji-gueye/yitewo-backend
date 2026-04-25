import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { PartnersModule } from './partners/partners.module';
import { OrdersModule } from './orders/orders.module';
import { ServiceRequestsModule } from './service-requests/service-requests.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuthModule } from './auth/auth.module';
import { ScraperModule } from './scraper/scraper.module';
import { PartnerPortalModule } from './partner-portal/partner-portal.module';
import { PartnerProductsModule } from './partner-products/partner-products.module';
import { SocialModule } from './social/social.module';
import { HealthModule } from './health/health.module';
import { UploadModule } from './upload/upload.module';
import { EmailModule } from './email/email.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    PrismaModule,
    CategoriesModule,
    UploadModule,
    EmailModule,
    ProductsModule,
    CloudinaryModule,
    PartnersModule,
    OrdersModule,
    ServiceRequestsModule,
    OpportunitiesModule,
    NotificationsModule,
    AuthModule,
    ScraperModule,
    PartnerPortalModule,
    PartnerProductsModule,
    SocialModule,
    HealthModule,
    WhatsappModule
  ],
})
export class AppModule { }
