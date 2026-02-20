import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private configService: ConfigService) {
        this.s3Client = new S3Client({
            region: this.configService.get<string>('AWS_REGION', 'ap-southeast-1'),
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
            key: `https://${this.bucketName}.s3.amazonaws.com/${key}`,
        };
    }
}
