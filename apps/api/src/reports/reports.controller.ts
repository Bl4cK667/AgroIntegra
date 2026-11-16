import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { ReportPeriodDto } from './report.dto';
import { ReportsService } from './reports.service';

// Resposta mínima usada para enviar o PDF (evita depender dos tipos do Express).
interface PdfResponse {
  setHeader(name: string, value: string): void;
  end(body: Buffer): void;
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // Mesmos dados do PDF, para a prévia na tela.
  @Get('producer/:id')
  producer(@Param('id', ParseUUIDPipe) id: string, @Query() period: ReportPeriodDto) {
    return this.reports.producerReport(id, period);
  }

  @Get('producer/:id/pdf')
  async producerPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() period: ReportPeriodDto,
    @CurrentUser() user: AuthUser,
    @Res() res: PdfResponse,
  ) {
    const { pdf, filename } = await this.reports.producerPdf(id, period, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.end(pdf);
  }
}
