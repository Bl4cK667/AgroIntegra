import { Module } from '@nestjs/common';
import { BulkReportsController } from './bulk-reports.controller';
import { BulkReportsService } from './bulk-reports.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({ controllers: [ReportsController, BulkReportsController], providers: [ReportsService, BulkReportsService] })
export class ReportsModule {}
