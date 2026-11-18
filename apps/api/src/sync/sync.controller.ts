import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { SyncPullService } from './sync-pull.service';
import { SyncPushService } from './sync-push.service';
import { DEFAULT_PULL_LIMIT, MAX_PUSH_OPERATIONS, SyncPullQueryDto, SyncPushDto } from './sync.dto';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(
    private readonly pushService: SyncPushService,
    private readonly pullService: SyncPullService,
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
