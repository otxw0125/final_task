import { Controller, Post, Body, UseGuards, Req, Get, Query } from '@nestjs/common';
import { SensorDataService } from './sensor-data.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('sensor-data')
export class SensorDataController {
  constructor(private sensorDataService: SensorDataService) {}

  @UseGuards(AuthGuard)
  @Post('raw')
  async postRaw(@Req() req, @Body() body: { x: number; y: number; z: number; timestamp: string }) {
    return this.sensorDataService.createRaw(req.user._id, { x: body.x, y: body.y, z: body.z, timestamp: new Date(body.timestamp) });
  }

  @UseGuards(AuthGuard)
  @Get('raw')
  async getRaw(@Req() req, @Query('limit') limit: string) {
    return this.sensorDataService.getLatestRaw(req.user._id, parseInt(limit) || 10);
  }
}
