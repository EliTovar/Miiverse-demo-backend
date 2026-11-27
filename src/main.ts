import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Comprime con gzip las respuestas de texto (JSON) de la API REST si el
  // navegador lo acepta. Las imágenes (ya comprimidas), las respuestas de
  // menos de 1 KB y el WebSocket de Socket.IO no pasan por aquí.
  // Si algún día el backend va detrás de Nginx u otro proxy, la compresión
  // se suele hacer allí y esta línea se puede quitar.
  app.use(compression());

  await app.listen(3000);
}
bootstrap();
