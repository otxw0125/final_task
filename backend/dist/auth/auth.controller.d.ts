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
    login(req: any): Promise<{
        status: string;
        user: any;
    }>;
    logout(req: any, res: any): Promise<void>;
    getProfile(req: any): {
        authenticated: boolean;
        user?: undefined;
    } | {
        authenticated: boolean;
        user: any;
    };
}
