import { Db, WithId, Document } from 'mongodb';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto';
type SensorRecord = {
    x: string;
    y: string;
    z: string;
    raw: string;
    timestamp: Date;
};
export declare class SensorDataService {
    private readonly db;
    private readonly collectionName;
    private readonly coll;
    constructor(db: Db);
    private parsePayload;
    create(dto: CreateSensorDataDto): Promise<WithId<Document & SensorRecord>>;
    findAll(): Promise<WithId<Document & SensorRecord>[]>;
}
export {};
