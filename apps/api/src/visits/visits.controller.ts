import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, StreamableFile } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CreateVisitDto } from './visit.dto';
import { VisitsService } from './visits.service';

// Imagem guardada no banco devolvida como arquivo, com o tipo conferido no envio.
const asFile = (img: { mimeType: string; data: Buffer }) => new StreamableFile(img.data, { type: img.mimeType });

@Controller('visits')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get()
  list(@Query('producerId') producerId?: string) {
    return this.visits.list(producerId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.visits.get(id);
  }

  @Post()
  create(@Body() dto: CreateVisitDto, @CurrentUser() user: AuthUser) {
    return this.visits.create(dto, user);
  }

  @Get(':id/photos/:photoId')
  @Header('Cache-Control', 'private, max-age=3600')
  async photo(@Param('id', ParseUUIDPipe) id: string, @Param('photoId', ParseUUIDPipe) photoId: string) {
    return asFile(await this.visits.photo(id, photoId));
  }

  @Get(':id/signature')
  @Header('Cache-Control', 'private, max-age=3600')
  async signature(@Param('id', ParseUUIDPipe) id: string) {
    return asFile(await this.visits.signature(id));
  }
}
