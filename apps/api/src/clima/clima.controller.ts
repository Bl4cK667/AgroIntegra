import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClimaService } from './clima.service';

@ApiTags('clima')
@ApiBearerAuth()
@Controller('clima')
export class ClimaController {
  constructor(private readonly clima: ClimaService) {}

  @Get('properties/:propertyId')
  @ApiOperation({
    summary: 'Previsão do tempo para a propriedade.',
    description:
      'INMET pelo município do cadastro (até 5 dias; os primeiros por manhã, tarde e noite) e, quando ligado e a propriedade tem localização, ' +
      'Open-Meteo no ponto (até 16 dias, com chuva em mm). Cada previsão traz fonte, local, data/hora do dado e crédito. ' +
      'Se a fonte falhar, devolve o último valor válido com stale=true e aviso; sem nenhum valor guardado, 503.',
  })
  property(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.clima.forProperty(propertyId);
  }

  @Get('municipalities/:ibgeCode')
  @ApiOperation({ summary: 'Previsão do INMET para um município (código IBGE de 7 dígitos).' })
  municipality(@Param('ibgeCode') ibgeCode: string) {
    return this.clima.forMunicipality(ibgeCode);
  }
}
