import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ProgramsService } from './programs.service';

// Somente leitura na demo.
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  list() {
    return this.programs.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.programs.get(id);
  }
}
