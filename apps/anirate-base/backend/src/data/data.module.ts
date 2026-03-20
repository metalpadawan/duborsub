// The data module exposes a single local datastore service for development.
// Using a global module keeps the demo small and avoids repetitive imports.
import { Global, Module } from '@nestjs/common';
import { DataService } from './data.service';

@Global()
@Module({
  providers: [DataService],
  exports: [DataService],
})
export class DataModule {}
