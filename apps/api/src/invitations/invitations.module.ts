import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

@Module({
  controllers: [InvitationsController, RegistrationController],
  providers: [InvitationsService, RegistrationService],
})
export class InvitationsModule {}
