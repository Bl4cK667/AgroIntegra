import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ConabImportService } from './conab-import.service';
import { CotacoesService } from './cotacoes.service';
import { CreateLocalPriceDto, HistoryQueryDto, LocalPriceQueryDto } from './cotacoes.dto';

@ApiTags('cotacoes')
@ApiBearerAuth()
@Controller('cotacoes')
export class CotacoesController {
  constructor(
    private readonly cotacoes: CotacoesService,
    private readonly importer: ConabImportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Cotações dos produtos acompanhados.',
    description:
      'Por produto: preço recebido pelo produtor na UF (CONAB, semanal, com variação para a semana anterior), praças municipais com dado recente ' +
      'e o último preço local lançado pela equipe. Valores já na unidade do campo (R$/@, R$/sc 60 kg...). Inclui o estado da última importação.',
  })
  overview() {
    return this.cotacoes.overview();
  }

  @Get('products/:key/history')
  @ApiOperation({ summary: 'Histórico semanal de um produto (CONAB por praça e preços locais).' })
  history(@Param('key') key: string, @Query() q: HistoryQueryDto) {
    return this.cotacoes.history(key, q.weeks);
  }

  @Get('local')
  @ApiOperation({ summary: 'Preços locais lançados pela equipe, do mais recente para o mais antigo (paginado).' })
  listLocal(@Query() q: LocalPriceQueryDto) {
    return this.cotacoes.listLocal(q);
  }

  @Post('local')
  @ApiOperation({ summary: 'Lança um preço local (coordenação ou técnico). Fica na auditoria.' })
  createLocal(@Body() dto: CreateLocalPriceDto, @CurrentUser() user: AuthUser) {
    return this.cotacoes.createLocal(dto, user);
  }

  @Delete('local/:id')
  @ApiOperation({ summary: 'Exclui (logicamente) um preço local. Só a coordenação ou quem lançou.' })
  removeLocal(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.cotacoes.removeLocal(id, user);
  }

  @Post('import')
  @HttpCode(200)
  @Roles(Role.COORDINATION)
  @ApiOperation({ summary: 'Importa agora os preços da CONAB (só coordenação). Normalmente roda sozinho, uma vez por dia.' })
  importNow() {
    return this.importer.importAll('manual', { force: true });
  }
}
