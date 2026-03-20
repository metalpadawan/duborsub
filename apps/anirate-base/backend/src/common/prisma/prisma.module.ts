// PrismaModule now provides the live PostgreSQL client plus a small development
// seed bootstrap so the app can populate demo data in an empty database.
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { PrismaBootstrapService } from './prisma-bootstrap.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService, PrismaBootstrapService],
  exports: [PrismaService],
})
export class PrismaModule {}
