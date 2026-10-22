// PrismaModule provides the PostgreSQL client to every module, seeds an empty
// database on boot, and prunes dead tokens.
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SeedService } from './seed.service';
import { TokenCleanupService } from './token-cleanup.service';

@Global()
@Module({
  providers: [PrismaService, SeedService, TokenCleanupService],
  exports: [PrismaService],
})
export class PrismaModule {}
