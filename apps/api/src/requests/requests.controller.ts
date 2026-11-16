import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CreateRequestDto, MoveRequestDto, PriorityDto } from './request.dto';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  // ?producerId=... filtra por produtor; ?open=true deixa de fora as concluídas.
  @Get()
  list(@Query('producerId') producerId?: string, @Query('open') open?: string) {
    return this.requests.list({ producerId, open: open === 'true' });
  }

  @Post()
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: AuthUser) {
    return this.requests.create(dto, user);
  }

  @Patch(':id/status')
  move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveRequestDto, @CurrentUser() user: AuthUser) {
    return this.requests.move(id, dto, user);
  }

  @Patch(':id/priority')
  priority(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PriorityDto, @CurrentUser() user: AuthUser) {
    return this.requests.setPriority(id, dto, user);
  }
}
