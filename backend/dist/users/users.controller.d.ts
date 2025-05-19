import { UsersService } from './users.service';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    register(body: {
        username: string;
        password: string;
    }): Promise<{
        username: string;
        password: string;
        createdAt: Date;
    }>;
    me(req: any): any;
}
