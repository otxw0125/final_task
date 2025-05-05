import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
export declare class AuthService {
    private readonly usersService;
    constructor(usersService: UsersService);
    signup(dto: CreateUserDto): Promise<any>;
    validateUser(username: string, password: string): Promise<any>;
}
