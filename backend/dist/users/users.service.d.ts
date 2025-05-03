import { Db } from 'mongodb';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersService {
    private readonly db;
    constructor(db: Db);
    create(createUserDto: CreateUserDto): Promise<any>;
    findOneByUsername(username: string): Promise<any | null>;
    findOneById(id: string): Promise<any | null>;
}
