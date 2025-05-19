"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SensorDataController = void 0;
const common_1 = require("@nestjs/common");
const sensor_data_service_1 = require("./sensor-data.service");
const auth_guard_1 = require("../auth/auth.guard");
let SensorDataController = class SensorDataController {
    sensorDataService;
    constructor(sensorDataService) {
        this.sensorDataService = sensorDataService;
    }
    async postRaw(req, body) {
        return this.sensorDataService.createRaw(req.user._id, { x: body.x, y: body.y, z: body.z, timestamp: new Date(body.timestamp) });
    }
    async getRaw(req, limit) {
        return this.sensorDataService.getLatestRaw(req.user._id, parseInt(limit) || 10);
    }
};
exports.SensorDataController = SensorDataController;
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Post)('raw'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SensorDataController.prototype, "postRaw", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)('raw'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SensorDataController.prototype, "getRaw", null);
exports.SensorDataController = SensorDataController = __decorate([
    (0, common_1.Controller)('sensor-data'),
    __metadata("design:paramtypes", [sensor_data_service_1.SensorDataService])
], SensorDataController);
//# sourceMappingURL=sensor-data.controller.js.map