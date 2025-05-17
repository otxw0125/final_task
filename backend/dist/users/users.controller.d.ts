import type { Request } from 'express';
import { UsersService } from './users.service';
import { User } from './interface/user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<import("mongodb").WithId<import("bson").Document>[]>;
    findOne(id: string): Promise<import("mongodb").WithId<import("bson").Document>>;
    getProfile(req: Request & {
        user: User;
    }): Promise<import("mongodb").WithId<import("bson").Document> | null>;
    create(dto: CreateUserDto): Promise<import("mongodb").WithId<import("bson").Document>>;
    update(id: string, dto: UpdateUserDto): Promise<import("mongodb").WithId<import("bson").Document>>;
    remove(id: string): Promise<void>;
}
