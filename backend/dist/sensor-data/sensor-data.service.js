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
exports.SensorDataService = void 0;
const common_1 = require("@nestjs/common");
const mongodb_1 = require("mongodb");
let SensorDataService = class SensorDataService {
    db;
    constructor(db) {
        this.db = db;
    }
    async createRaw(dto) {
        const record = {
            username: dto.username,
            raw: `${dto.x_accel},${dto.y_accel},${dto.z_accel}`,
            timestamp: new Date(dto.timestamp),
        };
        const result = await this.db.collection('sensor-data').insertOne(record);
        const inserted = await this.db
            .collection('sensor-data')
            .findOne({ _id: result.insertedId });
        if (!inserted) {
            throw new Error(`Inserted raw record not found (id: ${result.insertedId})`);
        }
        return inserted;
    }
    async findAllRaw() {
        return this.db.collection('sensor-data')
            .find()
            .sort({ timestamp: -1 })
            .toArray();
    }
    async processNewData() {
        const query = this.lastProcessedId
            ? { _id: { $gt: this.lastProcessedId } }
            : {};
        const rawColl = this.db.collection(this.rawCollName);
        const raws = await rawColl
            .find(query)
            .sort({ _id: 1 })
            .toArray();
        if (raws.length === 0)
            return 0;
        this.lastProcessedId = raws[raws.length - 1]._id;
        const groups = new Map();
        for (const r of raws) {
            const [x, y, z] = r.raw.split(',').map(s => parseFloat(s));
            const θx = Math.atan2(x, Math.hypot(y, z)) * (180 / Math.PI);
            const θy = Math.atan2(y, Math.hypot(x, z)) * (180 / Math.PI);
            const θz = Math.atan2(z, Math.hypot(x, y)) * (180 / Math.PI);
            const arr = groups.get(r.username) || [];
            arr.push([+θx.toFixed(2), +θy.toFixed(2), +θz.toFixed(2)]);
            groups.set(r.username, arr);
        }
        const batchColl = this.db.collection(this.batchCollName);
        for (const [username, angles] of groups.entries()) {
            for (let i = 0; i < angles.length; i += 20) {
                const chunk = angles.slice(i, i + 20);
                await batchColl.insertOne({
                    username,
                    angles: chunk,
                    createdAt: new Date(),
                });
            }
        }
        return raws.length;
    }
};
exports.SensorDataService = SensorDataService;
exports.SensorDataService = SensorDataService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('MONGO_DB')),
    __metadata("design:paramtypes", [mongodb_1.Db])
], SensorDataService);
//# sourceMappingURL=sensor-data.service.js.map