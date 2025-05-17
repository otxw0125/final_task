import { Controller, Get, UseGuards, Req, Post, Body } from '@nestjs/common';
import { MlResultService } from './ml-result.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('ml-results')
export class MlResultController {
  constructor(private mlResultService: MlResultService) {}

  @UseGuards(AuthGuard)
  @Post()
  async create(@Req() req, @Body() body: any) {
    return this.mlResultService.create(req.user._id, body);
  }

  @UseGuards(AuthGuard)
  @Get()
  async list(@Req() req) {
    return this.mlResultService.getByUser(req.user._id);
  }
}