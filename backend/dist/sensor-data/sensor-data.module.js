"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SensorDataModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const sensor_data_controller_1 = require("./sensor-data.controller");
const sensor_data_service_1 = require("./sensor-data.service");
const sensor_data_schema_1 = require("./schemas/sensor-data.schema");
let SensorDataModule = class SensorDataModule {
};
exports.SensorDataModule = SensorDataModule;
exports.SensorDataModule = SensorDataModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: sensor_data_schema_1.SensorData.name, schema: sensor_data_schema_1.SensorDataSchema }]),
        ],
        controllers: [sensor_data_controller_1.SensorDataController],
        providers: [sensor_data_service_1.SensorDataService],
        exports: [sensor_data_service_1.SensorDataService],
    })
], SensorDataModule);
//# sourceMappingURL=sensor-data.module.js.map