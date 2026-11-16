import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CreatePropertyDto } from '../properties/property.dto';
import { CreateProducerDto, UpdateProducerDto } from './producer.dto';
import { ProducersService } from './producers.service';

@Controller('producers')
export class ProducersController {
  constructor(private readonly producers: ProducersService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.producers.list(search);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.producers.get(id);
  }

  @Post()
  create(@Body() dto: CreateProducerDto, @CurrentUser() user: AuthUser) {
    return this.producers.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProducerDto, @CurrentUser() user: AuthUser) {
    return this.producers.update(id, dto, user);
  }

  @Post(':id/consent')
  consent(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.producers.registerConsent(id, user);
  }

  @Post(':id/properties')
  addProperty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePropertyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.producers.addProperty(id, dto, user);
  }
}
