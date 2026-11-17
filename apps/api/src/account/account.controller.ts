import { Body, Controller, Delete, Get, Header, Patch, Put, StreamableFile } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { ChangePasswordDto, UpdateAccountDto, UpdateAvatarDto } from './account.dto';
import { AccountService } from './account.service';

@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.account.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateAccountDto) {
    return this.account.update(user.id, dto);
  }

  @Get('avatar')
  @Header('Cache-Control', 'no-store')
  async avatar(@CurrentUser() user: AuthUser) {
    const img = await this.account.getAvatar(user.id);
    return new StreamableFile(img.data, { type: img.mimeType });
  }

  @Put('avatar')
  setAvatar(@CurrentUser() user: AuthUser, @Body() dto: UpdateAvatarDto) {
    return this.account.setAvatar(user.id, dto.image);
  }

  @Delete('avatar')
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.account.removeAvatar(user.id);
  }

  @Patch('password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.account.changePassword(user.id, dto);
  }
}
