import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, Body } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { searchWords } from '../common/search';
import { PrismaService } from '../prisma/prisma.service';
import { ProducersService } from '../producers/producers.service';
import { UpdatePropertyDto } from './property.dto';
import { propertyView } from './property.view';

@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly producers: ProducersService,
  ) {}

  @Get()
  async list(@Query('search') search?: string) {
    // Cada palavra precisa aparecer no nome/localidade da propriedade ou no nome do produtor.
    const where: Prisma.PropertyWhereInput = {
      AND: searchWords(search ?? '').map((w) => ({
        OR: [{ searchText: { contains: w } }, { producer: { searchName: { contains: w } } }],
      })),
    };
    const [rows, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        orderBy: { name: 'asc' },
        take: 200,
        include: { producer: { select: { id: true, name: true } } },
      }),
      this.prisma.property.count({ where }),
    ]);
    return {
      items: rows.map((p) => ({ ...propertyView(p), producer: p.producer })),
      total,
    };
  }

  // A regra da edição fica no ProducersService (o sync offline usa a mesma).
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePropertyDto, @CurrentUser() user: AuthUser) {
    return this.producers.updateProperty(id, dto, user);
  }
}
