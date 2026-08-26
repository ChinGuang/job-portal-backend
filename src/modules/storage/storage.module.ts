import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseStorageService } from './services/supabase-storage.service';
import { STORAGE_SERVICE } from './storage.tokens';

@Module({
  imports: [ConfigModule],
  providers: [{ provide: STORAGE_SERVICE, useClass: SupabaseStorageService }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
