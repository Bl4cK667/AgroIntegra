import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProducersModule } from './producers/producers.module';
import { VisitsModule } from './visits/visits.module';
import { RequestsModule } from './requests/requests.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProgramsModule } from './programs/programs.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AccountModule } from './account/account.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuditModule, AuthModule, ProducersModule, VisitsModule, RequestsModule, DashboardModule, ProgramsModule, ReportsModule, NotificationsModule, AccountModule],
  controllers: [HealthController],
})
export class AppModule {}
