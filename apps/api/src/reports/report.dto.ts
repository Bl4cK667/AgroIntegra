import { Matches } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ReportPeriodDto {
  @Matches(DAY, { message: 'Informe o início do período.' })
  from: string;

  @Matches(DAY, { message: 'Informe o fim do período.' })
  to: string;
}
