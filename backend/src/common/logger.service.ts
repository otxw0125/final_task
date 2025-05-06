import { Injectable, Scope } from '@nestjs/common';
import { Logger, LoggerService } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger extends Logger implements LoggerService {
  log(message: string) {
    super.log(message);
  }
  error(message: string, trace: string) {
    super.error(message, trace);
  }
  warn(message: string) {
    super.warn(message);
  }
  debug(message: string) {
    super.debug(message);
  }
  verbose(message: string) {
    super.verbose(message);
  }
}