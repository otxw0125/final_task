import { Db } from 'mongodb';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto';
export declare class SensorDataService {
    private readonly db;
    constructor(db: Db);
    create(createSensorDataDto: CreateSensorDataDto): Promise<any>;
}
