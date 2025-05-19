"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_module_1 = require("./config/config.module");
const database_module_1 = require("./database/database.module");
const common_module_1 = require("./common/common.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const sensor_data_module_1 = require("./sensor-data/sensor-data.module");
const ml_result_module_1 = require("./ml-result/ml-result.module");
const realtime_module_1 = require("./realtime/realtime.module");
const analysis_module_1 = require("./analysis/analysis.module");
const report_module_1 = require("./report/report.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_module_1.ConfigModule,
            database_module_1.DatabaseModule,
            common_module_1.CommonModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            sensor_data_module_1.SensorDataModule,
            ml_result_module_1.MlResultModule,
            realtime_module_1.RealtimeModule,
            analysis_module_1.AnalysisModule,
            report_module_1.ReportModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map