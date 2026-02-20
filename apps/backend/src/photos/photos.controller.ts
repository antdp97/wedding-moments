import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PhotosService } from './photos.service';
import { S3Service } from '../s3/s3.service';
import { ConfigService } from '@nestjs/config';
import {
    CreatePhotoDto,
    GetPresignedUrlDto,
    UpdatePhotoStatusDto,
} from '../dto';

@Controller('api')
export class PhotosController {
    private useLocalStorage: boolean;

    constructor(
        private readonly photosService: PhotosService,
        private readonly s3Service: S3Service,
        private readonly configService: ConfigService,
    ) {
        // Use local storage if AWS credentials are not configured
        const awsKey = this.configService.get<string>('AWS_ACCESS_KEY_ID', '');
        this.useLocalStorage = !awsKey || awsKey === 'your-access-key';
    }

    /**
     * POST /api/upload/presigned
     * Generate a presigned S3 upload URL (or local URL in dev mode)
     */
    @Post('upload/presigned')
    @HttpCode(HttpStatus.OK)
    async getPresignedUrl(@Body() dto: GetPresignedUrlDto) {
        if (this.useLocalStorage) {
            // In dev mode, return a local upload endpoint
            const fileExtension = dto.fileName.split('.').pop() || 'jpg';
            const key = `${uuidv4()}.${fileExtension}`;
            return {
                uploadUrl: `http://localhost:4000/api/upload/local`,
                key: key,
                useLocalUpload: true,
            };
        }
        return this.s3Service.getPresignedUploadUrl(dto.fileName, dto.fileType);
    }

    /**
     * POST /api/upload/local
     * Local file upload endpoint for development (bypasses S3)
     */
    @Post('upload/local')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './public/uploads',
                filename: (req, file, callback) => {
                    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
                    callback(null, uniqueName);
                },
            }),
            limits: {
                fileSize: 50 * 1024 * 1024, // 50MB max
            },
        }),
    )
    @HttpCode(HttpStatus.OK)
    async uploadLocal(@UploadedFile() file: Express.Multer.File) {
        return {
            url: `http://localhost:4000/uploads/${file.filename}`,
            key: file.filename,
        };
    }

    /**
     * POST /api/photo
     * Save photo metadata after upload completes
     */
    @Post('photo')
    @HttpCode(HttpStatus.CREATED)
    async createPhoto(@Body() dto: CreatePhotoDto) {
        return this.photosService.create(dto);
    }

    /**
     * GET /api/event/:slug/photos
     * Get all approved photos for an event
     */
    @Get('event/:slug/photos')
    async getEventPhotos(@Param('slug') slug: string) {
        return this.photosService.getApprovedPhotos(slug);
    }

    /**
     * PATCH /api/admin/photo/:id/status
     * Update photo status (approve/reject)
     */
    @Patch('admin/photo/:id/status')
    async updatePhotoStatus(
        @Param('id') id: string,
        @Body() dto: UpdatePhotoStatusDto,
    ) {
        return this.photosService.updateStatus(id, dto.status);
    }

    /**
     * GET /api/admin/event/:slug/photos
     * Get ALL photos for an event (admin view - all statuses)
     */
    @Get('admin/event/:slug/photos')
    async getAdminPhotos(@Param('slug') slug: string) {
        return this.photosService.getAllBySlug(slug);
    }

    /**
     * GET /api/admin/event/:slug/stats
     * Get photo stats for admin dashboard
     */
    @Get('admin/event/:slug/stats')
    async getEventStats(@Param('slug') slug: string) {
        return this.photosService.getStatsBySlug(slug);
    }

    /**
     * DELETE /api/admin/photo/:id
     * Permanently delete a photo
     */
    @Delete('admin/photo/:id')
    @HttpCode(HttpStatus.OK)
    async deletePhoto(@Param('id') id: string) {
        return this.photosService.delete(id);
    }

    // ============================================
    // Background Image Endpoints
    // ============================================

    /**
     * POST /api/admin/event/:slug/background
     * Save a new background image for the event
     */
    @Post('admin/event/:slug/background')
    async createBackground(
        @Param('slug') slug: string,
        @Body() body: { url: string; name?: string },
    ) {
        return this.photosService.createBackground(slug, body.url, body.name);
    }

    /**
     * GET /api/admin/event/:slug/backgrounds
     * List all background images for an event
     */
    @Get('admin/event/:slug/backgrounds')
    async getBackgrounds(@Param('slug') slug: string) {
        return this.photosService.getBackgrounds(slug);
    }

    /**
     * PATCH /api/admin/background/:id/activate
     * Set a background as active
     */
    @Patch('admin/background/:id/activate')
    async activateBackground(@Param('id') id: string) {
        return this.photosService.activateBackground(id);
    }

    /**
     * PATCH /api/admin/event/:slug/background/deactivate
     * Deactivate all backgrounds (revert to default)
     */
    @Patch('admin/event/:slug/background/deactivate')
    async deactivateAllBackgrounds(@Param('slug') slug: string) {
        return this.photosService.deactivateAllBackgrounds(slug);
    }

    /**
     * DELETE /api/admin/background/:id
     * Delete a background image
     */
    @Delete('admin/background/:id')
    @HttpCode(HttpStatus.OK)
    async deleteBackground(@Param('id') id: string) {
        return this.photosService.deleteBackground(id);
    }

    /**
     * GET /api/event/:slug/active-background
     * Public — get active background for Live Wall
     */
    @Get('event/:slug/active-background')
    async getActiveBackground(@Param('slug') slug: string) {
        return this.photosService.getActiveBackground(slug);
    }
}
