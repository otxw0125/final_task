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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSensorDataDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class AccelDto {
    x;
    y;
    z;
}
__decorate([
    (0, class_validator_1.IsNumber)({}, { message: '가속도 X값은 숫자여야 합니다.' }),
    (0, class_validator_1.IsNotEmpty)({ message: '가속도 X값은 필수입니다.' }),
    __metadata("design:type", Number)
], AccelDto.prototype, "x", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({}, { message: '가속도 Y값은 숫자여야 합니다.' }),
    (0, class_validator_1.IsNotEmpty)({ message: '가속도 Y값은 필수입니다.' }),
    __metadata("design:type", Number)
], AccelDto.prototype, "y", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({}, { message: '가속도 Z값은 숫자여야 합니다.' }),
    (0, class_validator_1.IsNotEmpty)({ message: '가속도 Z값은 필수입니다.' }),
    __metadata("design:type", Number)
], AccelDto.prototype, "z", void 0);
class CreateSensorDataDto {
    accel;
}
exports.CreateSensorDataDto = CreateSensorDataDto;
__decorate([
    (0, class_validator_1.IsObject)({ message: 'accel 필드는 객체여야 합니다.' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'accel 데이터는 필수입니다.' }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AccelDto),
    __metadata("design:type", AccelDto)
], CreateSensorDataDto.prototype, "accel", void 0);
//# sourceMappingURL=create-sensor-data.dto.js.map