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
exports.SensorDataService = void 0;
const common_1 = require("@nestjs/common");
const mongodb_1 = require("mongodb");
const database_service_1 = require("../database/database.service");
let SensorDataService = class SensorDataService {
    dbService;
    rawCollection;
    angleCollection;
    constructor(dbService) {
        this.dbService = dbService;
    }
    async onModuleInit() {
        const db = this.dbService.getDb();
        this.rawCollection = db.collection('rawSensorData');
        this.angleCollection = db.collection('angleData');
    }
    async createRaw(userId, data) {
        return this.rawCollection.insertOne({ userId: new mongodb_1.ObjectId(userId), ...data });
    }
    async getLatestRaw(userId, limit = 10) {
        return this.rawCollection
            .find({ userId: new mongodb_1.ObjectId(userId) })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
    }
    async createAngle(userId, angleData) {
        return this.angleCollection.insertOne({ userId: new mongodb_1.ObjectId(userId), ...angleData });
    }
    async processNewData() {
        const unprocessedData = await this.rawCollection
            .find({ processed: { $ne: true } })
            .sort({ timestamp: 1 })
            .limit(100)
            .toArray();
        if (unprocessedData.length === 0) {
            return { processed: 0, results: [] };
        }
        const results = [];
        for (const data of unprocessedData) {
            if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
                const roll = Math.atan2(data.y, data.z) * (180 / Math.PI);
                const pitch = Math.atan2(-data.x, Math.sqrt(data.y * data.y + data.z * data.z)) * (180 / Math.PI);
                const yaw = 0;
                await this.createAngle(data.userId.toString(), {
                    roll,
                    pitch,
                    yaw,
                    timestamp: data.timestamp
                });
                await this.rawCollection.updateOne({ _id: data._id }, { $set: { processed: true } });
                const results = [];
                results.push({ id: data._id, roll, pitch, yaw });
            }
        }
        return { processed: unprocessedData.length, results };
    }
};
exports.SensorDataService = SensorDataService;
exports.SensorDataService = SensorDataService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], SensorDataService);
//# sourceMappingURL=sensor-data.service.js.map