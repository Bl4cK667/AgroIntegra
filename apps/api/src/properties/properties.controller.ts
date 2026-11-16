import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { searchWords } from '../common/search';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePropertyDto } from './property.dto';
import { propertySearchText, propertyView } from './property.view';

@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePropertyDto, @CurrentUser() user: AuthUser) {
    const exists = await this.prisma.property.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Propriedade não encontrada.');
    const name = dto.name ?? exists.name;
    const locality = dto.locality ?? exists.locality;
    const prop = await this.prisma.property.update({
      where: { id },
      data: {
        name: dto.name,
        areaHa: dto.areaHa === undefined ? undefined : new Prisma.Decimal(dto.areaHa),
        locality: dto.locality,
        searchText: propertySearchText(name, locality),
        mainActivity: dto.mainActivity === undefined ? undefined : dto.mainActivity || null,
      },
    });
    await this.audit.record({
      userId: user.id,
      action: 'PROPERTY_UPDATED',
      entity: 'Property',
      entityId: id,
      details: { changed: Object.keys(dto).filter((k) => dto[k as keyof UpdatePropertyDto] !== undefined) },
    });
    return propertyView(prop);
  }
}
