import { Module } from '@nestjs/common';
import { PropertiesController } from '../properties/properties.controller';
import { ProducersController } from './producers.controller';
import { ProducersService } from './producers.service';

@Module({
  controllers: [ProducersController, PropertiesController],
  providers: [ProducersService],
})
export class ProducersModule {}
