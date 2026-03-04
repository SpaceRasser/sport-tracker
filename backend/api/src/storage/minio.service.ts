import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class MinioService {
  private s3: S3Client;
  private bucket: string;
  private publicBaseUrl: string | null;

  constructor(private config: ConfigService) {
    // ✅ теперь endpoint можно передавать целиком:
    // MINIO_ENDPOINT_URL=https://t3.storageapi.dev
    // или для minio: http://localhost:9000
    const endpointUrl =
      this.config.get<string>('MINIO_ENDPOINT_URL') ??
      this.config.get<string>('MINIO_PUBLIC_BASE_URL') ?? // fallback
      this.config.get<string>('MINIO_ENDPOINT') ?? // старое
      'http://localhost:9000';

    const accessKeyId =
      this.config.get<string>('MINIO_ACCESS_KEY') ??
      this.config.get<string>('MINIO_ROOT_USER') ??
      'minioadmin';

    const secretAccessKey =
      this.config.get<string>('MINIO_SECRET_KEY') ??
      this.config.get<string>('MINIO_ROOT_PASSWORD') ??
      'minioadmin';

    this.bucket = this.config.get<string>('MINIO_BUCKET') ?? 'avatars';

    // public base url (если есть публичная раздача)
    // если нет — просто вернём null и на клиенте можно будет не показывать прямую ссылку.
    this.publicBaseUrl =
      this.config.get<string>('MINIO_PUBLIC_BASE_URL')?.replace(/\/$/, '') ?? null;

    const forcePathStyle =
      (this.config.get<string>('S3_FORCE_PATH_STYLE') ?? 'false').toLowerCase() === 'true';

    const region = this.config.get<string>('S3_REGION') ?? 'auto';

    this.s3 = new S3Client({
      region,
      endpoint: endpointUrl,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async presignPutObject(params: { objectKey: string; contentType: string; expiresInSec?: number }) {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.objectKey,
      ContentType: params.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, cmd, {
      expiresIn: params.expiresInSec ?? 60,
    });

    const publicUrl = this.publicBaseUrl
      ? `${this.publicBaseUrl}/${this.bucket}/${params.objectKey}`
      : null;

    return { uploadUrl, publicUrl };
  }
}