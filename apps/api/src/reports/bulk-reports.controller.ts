import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { BULK_TYPES, BulkReportDownloadDto, BulkReportFiltersDto, BulkType } from './bulk-report.dto';
import { BulkReportsService } from './bulk-reports.service';

interface FileResponse {
  setHeader(name: string, value: string): void;
  end(body: Buffer): void;
}

function parseType(value: string): BulkType {
  if (!(BULK_TYPES as readonly string[]).includes(value)) {
    throw new BadRequestException('Tipo de relatório inválido. Use producers, properties ou visits.');
  }
  return value as BulkType;
}

// Exportação em massa (planilha CSV ou PDF). Coordenação e técnicos; técnico recebe só os próprios registros.
@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports/bulk')
export class BulkReportsController {
  constructor(private readonly bulk: BulkReportsService) {}

  @Get('filters')
  @ApiOperation({ summary: 'Opções dos filtros: comunidades, técnicos e programas' })
  filters(@CurrentUser() user: AuthUser) {
    return this.bulk.filterOptions(user);
  }

  @Get(':type/count')
  @ApiOperation({ summary: 'Quantos registros a exportação teria com estes filtros' })
  @ApiParam({ name: 'type', enum: BULK_TYPES })
  count(@Param('type') type: string, @Query() filters: BulkReportFiltersDto, @CurrentUser() user: AuthUser) {
    return this.bulk.count(parseType(type), filters, user);
  }

  @Get(':type')
  @ApiOperation({ summary: 'Baixa a exportação em CSV (padrão) ou PDF' })
  @ApiParam({ name: 'type', enum: BULK_TYPES })
  @ApiProduces('text/csv', 'application/pdf')
  async download(
    @Param('type') type: string,
    @Query() query: BulkReportDownloadDto,
    @CurrentUser() user: AuthUser,
    @Res() res: FileResponse,
  ) {
    const { format, ...filters } = query;
    const file = await this.bulk.export(parseType(type), format ?? 'csv', filters, user);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.end(file.body);
  }
}
