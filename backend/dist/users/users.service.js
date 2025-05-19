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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const mongodb_1 = require("mongodb");
const database_service_1 = require("../database/database.service");
const bcrypt = require("bcrypt");
let UsersService = class UsersService {
    dbService;
    collection;
    constructor(dbService) {
        this.dbService = dbService;
    }
    async onModuleInit() {
        const db = this.dbService.getDb();
        this.collection = db.collection('users');
    }
    async create(username, password) {
        const hashed = await bcrypt.hash(password, 10);
        const newUser = { username, password: hashed, createdAt: new Date() };
        await this.collection.insertOne(newUser);
        return newUser;
    }
    async findByUsername(username) {
        return this.collection.findOne({ username });
    }
    async findById(id) {
        return this.collection.findOne({ _id: new mongodb_1.ObjectId(id) });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], UsersService);
//# sourceMappingURL=users.service.js.map