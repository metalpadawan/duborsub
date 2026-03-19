import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getApiRoot() {
    return {
      name: 'AniRate API',
      status: 'ok',
      docs: {
        anime: '/api/v1/anime',
        auth: '/api/v1/auth/login',
        me: '/api/v1/auth/me',
        admin: '/api/v1/admin/dashboard',
      },
    };
  }
}
