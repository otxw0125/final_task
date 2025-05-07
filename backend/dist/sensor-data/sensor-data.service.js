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
    collectionName = 'sensor-data';
    coll;
    constructor(db) {
        this.db = db;
        this.coll = this.db.collection(this.collectionName);
    }
    parsePayload(payload) {
        const parts = payload.split(',').map(p => p.trim());
        if (parts.length !== 3) {
            throw new common_1.BadRequestException('Invalid payload format, expected "x,y,z"');
        }
        const [xStr, yStr, zStr] = parts;
        const x = parseFloat(xStr);
        const y = parseFloat(yStr);
        const z = parseFloat(zStr);
        if ([x, y, z].some(n => isNaN(n))) {
            throw new common_1.BadRequestException('Payload contains non-numeric values');
        }
        return { x, y, z };
    }
    async create(dto) {
        const { x_accel, y_accel, z_accel, timestamp } = dto;
        const record = {
            x: x_accel.toFixed(2),
            y: y_accel.toFixed(2),
            z: z_accel.toFixed(2),
            raw: `${x_accel.toFixed(2)},${y_accel.toFixed(2)},${z_accel.toFixed(2)}`,
            timestamp: new Date(timestamp),
        };
        const result = await this.coll.insertOne(record);
        console.log('[SensorDataService] Data inserted:', record);
        return this.coll.findOne({ _id: result.insertedId });
    }
    async findAll() {
        return this.coll.find().sort({ timestamp: -1 }).toArray();
    }
};
exports.SensorDataService = SensorDataService;
exports.SensorDataService = SensorDataService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('MONGO_DB')),
    __metadata("design:paramtypes", [mongodb_1.Db])
], SensorDataService);
//# sourceMappingURL=sensor-data.service.js.map