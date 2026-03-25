import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // supprime les champs non autorisés
      forbidNonWhitelisted: true, // erreur si champ inconnu
      transform: true, // transforme les types
    }),
  );
  await app.listen(3003);
}
bootstrap();
