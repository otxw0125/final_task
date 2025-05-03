"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongodb_1 = require("mongodb");
const database_constants_1 = require("./database.constants");
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [
            {
                provide: database_constants_1.DATABASE_CONNECTION,
                useFactory: async (configService) => {
                    const uri = configService.get('MONGODB_URI');
                    const dbName = configService.get('DB_NAME', 'ProjectDB');
                    if (!uri) {
                        throw new Error('MongoDB URI가 설정되지 않았습니다. .env 파일을 확인하세요.');
                    }
                    try {
                        const client = await mongodb_1.MongoClient.connect(uri);
                        console.log('MongoDB Native Driver Connected Successfully.');
                        process.on('SIGINT', async () => {
                            await client.close();
                            console.log('MongoDB connection closed due to app termination');
                            process.exit(0);
                        });
                        return client.db(dbName);
                    }
                    catch (e) {
                        console.error('MongoDB Native Driver Connection Error:', e);
                        throw e;
                    }
                },
                inject: [config_1.ConfigService],
            },
        ],
        exports: [database_constants_1.DATABASE_CONNECTION],
    })
], DatabaseModule);
//# sourceMappingURL=database.module.js.map