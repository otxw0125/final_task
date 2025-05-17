import { Db, ObjectId, WithId } from 'mongodb';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto';
type RawRecord = {
    _id?: ObjectId;
    username: string;
    raw: string;
    timestamp: Date;
};
export declare class SensorDataService {
    private readonly db;
    constructor(db: Db);
    createRaw(dto: CreateSensorDataDto): Promise<WithId<RawRecord>>;
    findAllRaw(): Promise<WithId<RawRecord>[]>;
    processNewData(): Promise<number>;
}
export {};
