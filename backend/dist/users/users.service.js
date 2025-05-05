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
let UsersService = class UsersService {
    db;
    collection = 'users';
    constructor(db) {
        this.db = db;
    }
    async create(dto) {
        const result = await this.db.collection(this.collection).insertOne(dto);
        return this.findOne(result.insertedId.toHexString());
    }
    async findAll() {
        return this.db.collection(this.collection).find().toArray();
    }
    async findOne(id) {
        const objId = new mongodb_1.ObjectId(id);
        const user = await this.db.collection(this.collection).findOne({ _id: objId });
        if (!user)
            throw new common_1.NotFoundException(`User ${id} not found`);
        return user;
    }
    async findOneByUsername(username) {
        return this.db.collection(this.collection).findOne({ username });
    }
    async update(id, dto) {
        const objId = new mongodb_1.ObjectId(id);
        await this.db.collection(this.collection).updateOne({ _id: objId }, { $set: dto });
        return this.findOne(id);
    }
    async remove(id) {
        const objId = new mongodb_1.ObjectId(id);
        const { deletedCount } = await this.db.collection(this.collection).deleteOne({ _id: objId });
        if (deletedCount === 0)
            throw new common_1.NotFoundException(`User ${id} not found`);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('MONGO_DB')),
    __metadata("design:paramtypes", [mongodb_1.Db])
], UsersService);
//# sourceMappingURL=users.service.js.map