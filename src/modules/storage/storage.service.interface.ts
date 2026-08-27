export interface UploadedObject {
  path: string;
}

/**
 * Sits behind a private object store (a single bucket per deployment, set
 * via config) so the transport is swappable and fake-able — real callers
 * get the Supabase adapter, tests bind the in-memory fake instead.
 */
export interface StorageService {
  upload(
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<UploadedObject>;

  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>;

  /** Whether an object is really stored at `path`, for keys a client sends. */
  exists(path: string): Promise<boolean>;

  delete(path: string): Promise<void>;
}
