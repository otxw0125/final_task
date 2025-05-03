import { SensorDataService } from './sensor-data.service';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto';
export declare class SensorDataController {
    private readonly sensorDataService;
    constructor(sensorDataService: SensorDataService);
    createSensorData(createSensorDataDto: CreateSensorDataDto): Promise<any>;
}
