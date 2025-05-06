import { SensorDataService } from './sensor-data.service';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto';
export declare class SensorDataController {
    private readonly service;
    constructor(service: SensorDataService);
    create(dto: CreateSensorDataDto): Promise<import("mongodb").WithId<import("bson").Document & {
        x: number;
        y: number;
        z: number;
        raw: string;
        timestamp: Date;
    }>>;
    findAll(): Promise<import("mongodb").WithId<import("bson").Document & {
        x: number;
        y: number;
        z: number;
        raw: string;
        timestamp: Date;
    }>[]>;
}
