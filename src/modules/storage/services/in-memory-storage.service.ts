import { Injectable } from '@nestjs/common';
import { StorageService, UploadedObject } from '../storage.service.interface';

interface StoredObject {
  body: Buffer;
  contentType: string;
}

/**
 * Test fake bound behind STORAGE_SERVICE in e2e tests, so no test touches
 * Supabase. Records uploads and returns predictable signed URLs.
 */
@Injectable()
export class InMemoryStorageService implements StorageService {
  private readonly objects = new Map<string, StoredObject>();
  private failNextUpload = false;

  upload(
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<UploadedObject> {
    if (this.failNextUpload) {
      this.failNextUpload = false;
      return Promise.reject(new Error('Simulated upload failure'));
    }
    this.objects.set(path, { body, contentType });
    return Promise.resolve({ path });
  }

  createSignedUrl(path: string, expiresInSeconds: number): Promise<string> {
    if (!this.objects.has(path)) {
      return Promise.reject(new Error(`No such object: ${path}`));
    }
    return Promise.resolve(
      `https://fake-storage.test/${path}?expiresIn=${expiresInSeconds}`,
    );
  }

  delete(path: string): Promise<void> {
    this.objects.delete(path);
    return Promise.resolve();
  }

  has(path: string): boolean {
    return this.objects.has(path);
  }

  /** Test-only hook: makes the next upload() call reject once. */
  failNextUploadOnce(): void {
    this.failNextUpload = true;
  }
}
