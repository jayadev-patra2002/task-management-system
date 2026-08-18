import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
  );

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe(),
  );

  app.setGlobalPrefix("api");

  const port =
    process.env.PORT || 4000;

  await app.listen(port);

  console.log(
    `Server running on http://localhost:${port}`,
  );
}

bootstrap();