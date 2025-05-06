// src/common/pipes/validation.pipe.ts
import { Injectable, ValidationPipe } from '@nestjs/common';

@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  }
}
