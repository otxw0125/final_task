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
const config_1 = require("@nestjs/config");
const mongo_module_1 = require("./common/mongo.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const sensor_data_module_1 = require("./sensor-data/sensor-data.module");
const ml_results_module_1 = require("./ml-results/ml-results.module");
const common_module_1 = require("./common/common.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            mongo_module_1.MongoModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            sensor_data_module_1.SensorDataModule,
            ml_results_module_1.MlResultsModule,
            common_module_1.CommonModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map