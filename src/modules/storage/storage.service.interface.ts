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

  /**
   * Whether an object is actually stored at `path`.
   *
   * Needed because a stored key travels as a plain string — an application
   * snapshots one, and an employer later exchanges it for a signed URL. Any
   * path a client hands us therefore has to be checked against what is really
   * in the bucket, or a request could name a file that was never uploaded.
   */
  exists(path: string): Promise<boolean>;

  delete(path: string): Promise<void>;
}
