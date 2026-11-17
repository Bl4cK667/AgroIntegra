import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { CreateInvitationDto } from './invitation.dto';
import { InvitationsService } from './invitations.service';

// Somente a coordenação da organização atual (role da membership, verificado no AuthGuard).
@Controller('invitations')
@Roles(Role.COORDINATION)
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvitationDto) {
    return this.invitations.create(user, dto);
  }

  @Get()
  list() {
    return this.invitations.list();
  }

  @Delete(':id')
  @HttpCode(200)
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitations.revoke(user, id);
  }
}
