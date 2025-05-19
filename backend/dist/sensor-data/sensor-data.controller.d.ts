import { SensorDataService } from './sensor-data.service';
export declare class SensorDataController {
    private sensorDataService;
    constructor(sensorDataService: SensorDataService);
    postRaw(req: any, body: {
        x: number;
        y: number;
        z: number;
        timestamp: string;
    }): Promise<import("mongodb").InsertOneResult<import("bson").Document>>;
    getRaw(req: any, limit: string): Promise<import("mongodb").WithId<import("bson").Document>[]>;
}
