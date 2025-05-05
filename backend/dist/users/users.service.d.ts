import { Db, WithId, Document } from 'mongodb';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private readonly db;
    private readonly collection;
    constructor(db: Db);
    create(dto: CreateUserDto): Promise<WithId<Document>>;
    findAll(): Promise<WithId<Document>[]>;
    findOne(id: string): Promise<WithId<Document>>;
    findOneByUsername(username: string): Promise<WithId<Document> | null>;
    update(id: string, dto: UpdateUserDto): Promise<WithId<Document>>;
    remove(id: string): Promise<void>;
}
