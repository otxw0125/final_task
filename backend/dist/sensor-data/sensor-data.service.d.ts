import { OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
export declare class SensorDataService implements OnModuleInit {
    private dbService;
    private rawCollection;
    private angleCollection;
    constructor(dbService: DatabaseService);
    onModuleInit(): Promise<void>;
    createRaw(userId: string, data: {
        x: number;
        y: number;
        z: number;
        timestamp: Date;
    }): Promise<import("mongodb").InsertOneResult<import("bson").Document>>;
    getLatestRaw(userId: string, limit?: number): Promise<import("mongodb").WithId<import("bson").Document>[]>;
    createAngle(userId: string, angleData: {
        roll: number;
        pitch: number;
        yaw: number;
        timestamp: Date;
    }): Promise<import("mongodb").InsertOneResult<import("bson").Document>>;
    processNewData(): Promise<{
        processed: number;
        results: never[];
    }>;
}
