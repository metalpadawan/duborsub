import { Global, Module } from '@nestjs/common';
import { MonitoringController, HealthController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Global()
@Module({
  controllers: [HealthController, MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
