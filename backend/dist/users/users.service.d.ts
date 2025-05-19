import { OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
export declare class UsersService implements OnModuleInit {
    private dbService;
    private collection;
    constructor(dbService: DatabaseService);
    onModuleInit(): Promise<void>;
    create(username: string, password: string): Promise<{
        username: string;
        password: string;
        createdAt: Date;
    }>;
    findByUsername(username: string): Promise<import("mongodb").WithId<import("bson").Document> | null>;
    findById(id: string): Promise<import("mongodb").WithId<import("bson").Document> | null>;
}
