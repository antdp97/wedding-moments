import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
    private s3Client: S3Client;
    private bucketName: string;
    private region: string;
    private publicBaseUrl: string;

    constructor(private configService: ConfigService) {
        this.region = this.configService.get<string>('AWS_REGION', 'ap-southeast-1');

        this.s3Client = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
                secretAccessKey: this.configService.get<string>(
                    'AWS_SECRET_ACCESS_KEY',
                    '',
                ),
            },
        });
        this.bucketName = this.configService.get<string>(
            'S3_BUCKET_NAME',
            'liveevent-uploads',
        );
        this.publicBaseUrl = (
            this.configService.get<string>(
                'AWS_PUBLIC_URL',
                `https://${this.bucketName}.s3.${this.region}.amazonaws.com`,
            ) || `https://${this.bucketName}.s3.${this.region}.amazonaws.com`
        ).replace(/\/+$/, '');
    }

    getPublicBaseUrl(): string {
        return this.publicBaseUrl;
    }

    normalizePublicUrl(url: string | null | undefined): string | null | undefined {
        if (!url) {
            return url;
        }

        let parsedUrl: URL;

        try {
            parsedUrl = new URL(url);
        } catch {
            return url;
        }

        const objectKey = this.extractObjectKey(parsedUrl);
        if (!objectKey) {
            return url;
        }

        return `${this.publicBaseUrl}/${objectKey}`;
    }

    private extractObjectKey(url: URL): string | null {
        const normalizedPath = url.pathname.replace(/^\/+/, '');
        const virtualHostedHosts = new Set([
            `${this.bucketName}.s3.amazonaws.com`,
            `${this.bucketName}.s3.${this.region}.amazonaws.com`,
        ]);
        const pathStyleHosts = new Set([
            's3.amazonaws.com',
            `s3.${this.region}.amazonaws.com`,
        ]);

        if (virtualHostedHosts.has(url.host)) {
            return normalizedPath || null;
        }

        if (pathStyleHosts.has(url.host) && normalizedPath.startsWith(`${this.bucketName}/`)) {
            return normalizedPath.slice(this.bucketName.length + 1) || null;
        }

        return null;
    }

    async getPresignedUploadUrl(
        fileName: string,
        fileType: string,
    ): Promise<{ uploadUrl: string; key: string }> {
        const fileExtension = fileName.split('.').pop() || 'jpg';
        const key = `uploads/${uuidv4()}.${fileExtension}`;

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: fileType,
        });

        const uploadUrl = await getSignedUrl(this.s3Client, command, {
            expiresIn: 3600, // 1 hour
        });

        return {
            uploadUrl,
            key: `${this.publicBaseUrl}/${key}`,
        };
    }
}
