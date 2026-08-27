import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnvKey } from '../../../common/constants/config';
import { StorageService, UploadedObject } from '../storage.service.interface';

const DEFAULT_RESUME_BUCKET = 'resumes';

@Injectable()
export class SupabaseStorageService implements StorageService {
  private readonly bucket: string;
  private lazyClient?: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    this.bucket =
      configService.get<string>(EnvKey.SUPABASE_RESUME_BUCKET) ??
      DEFAULT_RESUME_BUCKET;
  }

  // Lazy: this provider is constructed as part of the module graph on every
  // boot, including in tests that never touch storage (they bind
  // STORAGE_SERVICE to the in-memory fake instead) — building a real
  // SupabaseClient eagerly in the constructor would spin up its realtime/
  // websocket machinery for no reason on every one of those boots.
  private get client(): SupabaseClient {
    if (!this.lazyClient) {
      const supabaseUrl =
        this.configService.get<string>(EnvKey.SUPABASE_URL) ?? '';
      const serviceRoleKey =
        this.configService.get<string>(EnvKey.SUPABASE_SERVICE_ROLE_KEY) ?? '';
      // The service-role key never reaches a client — uploads are proxied
      // through this server-side adapter only.
      this.lazyClient = createClient(supabaseUrl, serviceRoleKey);
    }
    return this.lazyClient;
  }

  async upload(
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<UploadedObject> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .upload(path, body, { contentType, upsert: true });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload to storage: ${error.message}`,
      );
    }
    return { path: data.path };
  }

  async createSignedUrl(
    path: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      throw new InternalServerErrorException(
        `Failed to create signed URL: ${error.message}`,
      );
    }
    return data.signedUrl;
  }

  // Listed rather than signed: unlike createSignedUrl, `list` distinguishes
  // "no such object" from a real failure.
  async exists(path: string): Promise<boolean> {
    const separator = path.lastIndexOf('/');
    const directory = separator === -1 ? '' : path.slice(0, separator);
    const name = path.slice(separator + 1);

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(directory, { search: name });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to look up storage object: ${error.message}`,
      );
    }
    // `search` is a prefix match, so the exact name still has to be confirmed.
    return (data ?? []).some((object) => object.name === name);
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([path]);

    if (error) {
      throw new InternalServerErrorException(
        `Failed to delete from storage: ${error.message}`,
      );
    }
  }
}
