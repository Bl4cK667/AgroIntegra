import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { VisitsService } from '../visits/visits.service';
import { SyncPullService } from './sync-pull.service';
import { SyncPushService } from './sync-push.service';
import { DEFAULT_PULL_LIMIT, MAX_PUSH_OPERATIONS, SyncPhotoDto, SyncPullQueryDto, SyncPushDto } from './sync.dto';

const uuidV4 = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new BadRequestException('Identificador inválido: use um UUID v4 gerado no aparelho.'),
});

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(
    private readonly pushService: SyncPushService,
    private readonly pullService: SyncPullService,
    private readonly visits: VisitsService,
  ) {}

  @Post('push')
  @HttpCode(200)
  @ApiOperation({
    summary: `Envia até ${MAX_PUSH_OPERATIONS} alterações feitas offline no aparelho.`,
    description:
      'Cada operação é aplicada na ordem e de forma independente, e recebe seu resultado: applied, duplicate, rejected (conflito vencido pelo servidor, ' +
      'com a versão do servidor em record) ou error (message; retry=true só para falha temporária). Reenviar o mesmo lote não duplica nada. ' +
      'Conflito: vence o updatedAt mais recente, e o conflito fica registrado na auditoria (SYNC_CONFLICT).',
  })
  push(@Body() dto: SyncPushDto, @CurrentUser() user: AuthUser) {
    return this.pushService.push(dto.operations, user);
  }

  @Put('visits/:visitId/photos/:photoId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Envia uma foto de visita já sincronizada (as fotos vão depois dos dados).',
    description:
      'photoId é o UUID v4 gerado no aparelho: reenviar a mesma foto devolve status duplicate. Só acrescenta (até 3 por visita) e só o técnico ' +
      'que registrou a visita. O tipo é conferido pelo conteúdo do arquivo.',
  })
  async photo(
    @Param('visitId', uuidV4) visitId: string,
    @Param('photoId', uuidV4) photoId: string,
    @Body() dto: SyncPhotoDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.visits.addPhoto(visitId, photoId, dto.image, user);
    return { status: result.created ? 'applied' : 'duplicate', visitId, photo: result.photo };
  }

  @Get('pull')
  @ApiOperation({
    summary: 'Registros da organização alterados desde o último pull, inclusive os excluídos (deletedAt).',
    description:
      `Repita com since=cursor enquanto hasMore for true. Até ${DEFAULT_PULL_LIMIT} registros por entidade por página (limit). ` +
      'CPF sempre mascarado; fotos e assinatura não vêm (só os ids das fotos).',
  })
  pull(@Query() q: SyncPullQueryDto) {
    return this.pullService.pull(q.since, q.limit);
  }
}
