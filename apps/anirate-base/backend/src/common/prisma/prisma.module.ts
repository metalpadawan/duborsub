// Prisma is preserved as a reference module because the original project design used it.
// The current local runtime uses the in-memory DataService instead, but keeping this module
// documented makes the future move back to Postgres much easier.
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
