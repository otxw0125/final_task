import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard as NestAuthGuard } from '@nestjs/passport';

@Injectable()
export class AuthGuard {
  // This guard checks if the user is authenticated via session
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Check if the request has a session with an authenticated user
    if (request.isAuthenticated()) {
      return true;
    }
    
    throw new UnauthorizedException('Not authenticated');
  }
}