import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { PhotoStatus } from '@prisma/client';

// ============================================
// UPLOAD DTOs
// ============================================

export class GetPresignedUrlDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    fileType: string;
}

export class PresignedUrlResponseDto {
    uploadUrl: string;
    key: string;
}

// ============================================
// PHOTO DTOs
// ============================================

export class CreatePhotoDto {
    @IsString()
    @IsNotEmpty()
    eventId: string;

    @IsString()
    @IsNotEmpty()
    url: string;

    @IsString()
    @IsOptional()
    senderName?: string;

    @IsString()
    @IsOptional()
    message?: string;

    @IsString()
    @IsOptional()
    mimeType?: string;
}

export class UpdatePhotoStatusDto {
    @IsEnum(PhotoStatus)
    @IsNotEmpty()
    status: PhotoStatus;
}

export class PhotoResponseDto {
    id: string;
    eventId: string;
    url: string;
    thumbnailUrl?: string | null;
    senderName?: string | null;
    message?: string | null;
    status: PhotoStatus;
    createdAt: Date;
}

// ============================================
// EVENT DTOs
// ============================================

export class CreateEventDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    slug: string;

    @IsString()
    @IsNotEmpty()
    hostId: string;
}

export class EventSettingsDto {
    autoApprove?: boolean;
    theme?: string;
}
