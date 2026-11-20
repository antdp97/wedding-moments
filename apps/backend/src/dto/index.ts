import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { PhotoStatus } from '@prisma/client';
import type {
    CreateEventRequest,
    CreatePhotoRequest,
    GetPresignedUrlRequest,
    PresignedUrlResponse,
    UpdatePhotoStatusRequest,
} from '@wedding-moments/shared';

// ============================================
// UPLOAD DTOs
// ============================================

export class GetPresignedUrlDto implements GetPresignedUrlRequest {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    fileType: string;
}

export class PresignedUrlResponseDto implements PresignedUrlResponse {
    uploadUrl: string;
    key: string;
}

// ============================================
// PHOTO DTOs
// ============================================

export class CreatePhotoDto implements CreatePhotoRequest {
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

export class UpdatePhotoStatusDto implements UpdatePhotoStatusRequest {
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

export class CreateEventDto implements CreateEventRequest {
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
