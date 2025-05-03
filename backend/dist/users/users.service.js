"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const mongodb_1 = require("mongodb");
const database_constants_1 = require("../database/database.constants");
const bcrypt = require("bcrypt");
let UsersService = class UsersService {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(createUserDto) {
        const { username, email, password } = createUserDto;
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newUser = {
            username,
            email,
            password: hashedPassword,
            createdAt: new Date(),
        };
        const result = await this.db.collection('users').insertOne(newUser);
        console.log('User created with ID:', result.insertedId);
        return { id: result.insertedId, username, email };
    }
    async findOneByUsername(username) {
        return this.db.collection('users').findOne({ username });
    }
    async findOneById(id) {
        if (!mongodb_1.ObjectId.isValid(id)) {
            return null;
        }
        return this.db.collection('users').findOne({ _id: new mongodb_1.ObjectId(id) });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_constants_1.DATABASE_CONNECTION)),
    __metadata("design:paramtypes", [mongodb_1.Db])
], UsersService);
//# sourceMappingURL=users.service.js.map