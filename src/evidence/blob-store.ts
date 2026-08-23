import { randomUUID } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type EvidenceUploadIntentInput = {
  tenantId: string;
  estimateId: string;
  mimeType: string;
  sha256: string;
  fileName?: string;
};

export type EvidenceUploadIntent = {
  storageKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
};

export interface EvidenceBlobStore {
  createUploadIntent(input: EvidenceUploadIntentInput): Promise<EvidenceUploadIntent>;
  verifyObject(storageKey: string, expectedSha256: string): Promise<boolean>;
  createDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
}

export type R2BlobStoreConfig = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  uploadExpiresSeconds?: number;
};

function safeName(value?: string): string {
  const normalized = (value ?? 'evidence.bin').normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.slice(0, 120) || 'evidence.bin';
}

function assertSha256(value: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error('invalid_sha256');
}

function hexToBase64(value: string): string {
  return Buffer.from(value, 'hex').toString('base64');
}

export class R2EvidenceBlobStore implements EvidenceBlobStore {
  private readonly client: S3Client;
  private readonly uploadExpiresSeconds: number;

  constructor(private readonly config: R2BlobStoreConfig) {
    if (!/^[a-f0-9]{32}$/i.test(config.accountId)) throw new Error('invalid_r2_account_id');
    if (!config.bucket.trim()) throw new Error('invalid_r2_bucket');
    if (!config.accessKeyId.trim() || !config.secretAccessKey.trim()) throw new Error('invalid_r2_credentials');
    this.uploadExpiresSeconds = Math.min(Math.max(config.uploadExpiresSeconds ?? 900, 60), 3600);
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async createUploadIntent(input: EvidenceUploadIntentInput): Promise<EvidenceUploadIntent> {
    assertSha256(input.sha256);
    const mimeType = input.mimeType.trim().toLowerCase();
    if (!mimeType || mimeType.length > 150) throw new Error('invalid_mime_type');
    const storageKey = `evidence/${input.tenantId}/${input.estimateId}/${randomUUID()}-${safeName(input.fileName)}`;
    const checksum = hexToBase64(input.sha256);
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
        ContentType: mimeType,
        ChecksumSHA256: checksum,
      }),
      { expiresIn: this.uploadExpiresSeconds },
    );
    return {
      storageKey,
      uploadUrl,
      method: 'PUT',
      headers: { 'content-type': mimeType, 'x-amz-checksum-sha256': checksum },
      expiresAt: new Date(Date.now() + this.uploadExpiresSeconds * 1000).toISOString(),
    };
  }

  async verifyObject(storageKey: string, expectedSha256: string): Promise<boolean> {
    assertSha256(expectedSha256);
    const response = await this.client.send(new HeadObjectCommand({
      Bucket: this.config.bucket,
      Key: storageKey,
      ChecksumMode: 'ENABLED',
    }));
    return response.ChecksumSHA256 === hexToBase64(expectedSha256);
  }

  async createDownloadUrl(storageKey: string, expiresInSeconds = 300): Promise<string> {
    const expiresIn = Math.min(Math.max(expiresInSeconds, 30), 3600);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.config.bucket, Key: storageKey }), { expiresIn });
  }
}

export function r2BlobStoreConfigFromEnv(env: NodeJS.ProcessEnv = process.env): R2BlobStoreConfig | null {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const bucket = env.R2_BUCKET?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const supplied = [accountId, bucket, accessKeyId, secretAccessKey].filter(Boolean).length;
  if (supplied === 0) return null;
  if (supplied !== 4) throw new Error('incomplete_r2_configuration');
  return { accountId: accountId!, bucket: bucket!, accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! };
}
