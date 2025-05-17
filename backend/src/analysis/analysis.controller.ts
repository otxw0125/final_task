import { Controller, Post, UseGuards, Req } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('analysis')
export class AnalysisController {
  constructor(private analysisService: AnalysisService) {}

  @UseGuards(AuthGuard)
  @Post()
  async predict(@Req() req) {
    return this.analysisService.analyze(req.user._id);
  }
}