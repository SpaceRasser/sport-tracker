import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class MinioService {
  private s3: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor(private config: ConfigService) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT') ?? 'localhost';
    const port = Number(this.config.get<string>('MINIO_PORT') ?? 9000);

    const accessKeyId =
  this.config.get<string>('MINIO_ROOT_USER') ??
  this.config.get<string>('MINIO_ACCESS_KEY') ??
  'minioadmin';

const secretAccessKey =
  this.config.get<string>('MINIO_ROOT_PASSWORD') ??
  this.config.get<string>('MINIO_SECRET_KEY') ??
  'minioadmin';

console.log('[MinIO] accessKeyId =', accessKeyId);



    this.bucket = this.config.get<string>('MINIO_BUCKET') ?? 'avatars';
    this.publicBaseUrl = (this.config.get<string>('MINIO_PUBLIC_BASE_URL') ?? `http://${endpoint}:${port}`).replace(/\/$/, '');

    this.s3 = new S3Client({
      region: 'us-east-1',
      endpoint: `http://${endpoint}:${port}`,
      forcePathStyle: true, // важно для MinIO
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

    const publicUrl = `${this.publicBaseUrl}/${this.bucket}/${encodeURIComponent(params.objectKey)}`;
    return { uploadUrl, publicUrl };
  }
}
