import { Body, Controller, Delete, Get, Header, Patch, Put, StreamableFile } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { ChangePasswordDto, UpdateAccountDto, UpdateAvatarDto } from './account.dto';
import { AccountService } from './account.service';

// Perfil exibido é o da membership na organização atual (não o User.role legado).
const withMembership = <T extends object>(user: AuthUser, view: T) => ({ ...view, role: user.role, organizationId: user.organizationId });

@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    return withMembership(user, await this.account.get(user.id));
  }

  @Patch()
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateAccountDto) {
    return withMembership(user, await this.account.update(user.id, dto));
  }

  @Get('avatar')
  @Header('Cache-Control', 'no-store')
  async avatar(@CurrentUser() user: AuthUser) {
    const img = await this.account.getAvatar(user.id);
    return new StreamableFile(img.data, { type: img.mimeType });
  }

  @Put('avatar')
  async setAvatar(@CurrentUser() user: AuthUser, @Body() dto: UpdateAvatarDto) {
    return withMembership(user, await this.account.setAvatar(user.id, dto.image));
  }

  @Delete('avatar')
  async removeAvatar(@CurrentUser() user: AuthUser) {
    return withMembership(user, await this.account.removeAvatar(user.id));
  }

  @Patch('password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.account.changePassword(user.id, dto);
  }
}
