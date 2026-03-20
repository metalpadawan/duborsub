// The data module exposes a single in-memory store for local development.
// Using a global module keeps the demo small and avoids repetitive imports.
import { Global, Module } from '@nestjs/common';
import { DataService } from './data.service';

@Global()
@Module({
  providers: [DataService],
  exports: [DataService],
})
export class DataModule {}
