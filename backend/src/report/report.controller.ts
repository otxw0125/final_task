import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import { ReportService } from './report.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('report')
export class ReportController {
  constructor(private reportService: ReportService) {}

  @UseGuards(AuthGuard)
  @Get()
  async getReport(@Req() req, @Res() res) {
    await this.reportService.generate(req.user._id, res);
  }
}