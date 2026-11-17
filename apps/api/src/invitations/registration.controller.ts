import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { RegisterDto, RegistrationTokenDto } from './invitation.dto';
import { RegistrationService } from './registration.service';

// Rotas públicas, mas só funcionam com token de convite válido. Token sempre no corpo
// (nunca na URL da API), para não aparecer em access logs.
@Controller('auth')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  // Pré-visualização do convite: { email, organizationName, expiresAt }.
  @Public()
  @Post('registration')
  @HttpCode(200)
  inspect(@Body() dto: RegistrationTokenDto) {
    return this.registration.inspect(dto.token);
  }

  // Conclui o cadastro. Não devolve sessão: a pessoa entra depois por POST /auth/login.
  @Public()
  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterDto) {
    return this.registration.register(dto);
  }
}
