import type { Request, Response } from 'express';
import { User } from '../users/interface/user.interface';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    signup(dto: CreateUserDto): Promise<{
        status: string;
        user: {
            [key: string]: any;
            _id: import("bson").ObjectId;
        };
    }>;
    login(req: Request & {
        user: User;
    }, res: Response): Promise<{
        status: string;
        user: Express.User & User;
    }>;
    logout(req: Request, res: Response): Promise<void>;
    getProfile(req: Request): {
        authenticated: boolean;
        user?: undefined;
    } | {
        authenticated: boolean;
        user: Express.User;
    };
}
