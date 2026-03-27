import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const bucketName = process.env.S3_BUCKET_NAME;
const region = process.env.AWS_REGION || 'ap-southeast-1';
const publicBaseUrl = (
    process.env.AWS_PUBLIC_URL || (bucketName ? `https://${bucketName}.s3.${region}.amazonaws.com` : '')
).replace(/\/+$/, '');

function buildVirtualHostedHosts(bucket: string, awsRegion: string): Set<string> {
    return new Set([
        `${bucket}.s3.amazonaws.com`,
        `${bucket}.s3.${awsRegion}.amazonaws.com`,
    ]);
}

function buildPathStyleHosts(awsRegion: string): Set<string> {
    return new Set([
        's3.amazonaws.com',
        `s3.${awsRegion}.amazonaws.com`,
    ]);
}

function rewriteUrl(
    url: string | null | undefined,
    virtualHostedHosts: Set<string>,
    pathStyleHosts: Set<string>,
): string | null | undefined {
    if (!url || !bucketName || !publicBaseUrl) {
        return url;
    }

    let parsedUrl: URL;

    try {
        parsedUrl = new URL(url);
    } catch {
        return url;
    }

    const normalizedPath = parsedUrl.pathname.replace(/^\/+/, '');
    if (virtualHostedHosts.has(parsedUrl.host)) {
        return `${publicBaseUrl}/${normalizedPath}`;
    }

    if (pathStyleHosts.has(parsedUrl.host) && normalizedPath.startsWith(`${bucketName}/`)) {
        return `${publicBaseUrl}/${normalizedPath.slice(bucketName.length + 1)}`;
    }

    return url;
}

async function main() {
    if (!bucketName) {
        throw new Error('S3_BUCKET_NAME is required to rewrite media URLs.');
    }

    if (!publicBaseUrl) {
        throw new Error('AWS_PUBLIC_URL or a valid S3 bucket configuration is required to rewrite media URLs.');
    }

    const virtualHostedHosts = buildVirtualHostedHosts(bucketName, region);
    const pathStyleHosts = buildPathStyleHosts(region);

    const photos = await prisma.photo.findMany({
        select: {
            id: true,
            url: true,
            thumbnailUrl: true,
        },
    });

    let updatedPhotoUrls = 0;
    let updatedPhotoThumbnails = 0;

    for (const photo of photos) {
        const nextUrl = rewriteUrl(photo.url, virtualHostedHosts, pathStyleHosts);
        const nextThumbnailUrl = rewriteUrl(photo.thumbnailUrl, virtualHostedHosts, pathStyleHosts);

        if (nextUrl === photo.url && nextThumbnailUrl === photo.thumbnailUrl) {
            continue;
        }

        await prisma.photo.update({
            where: { id: photo.id },
            data: {
                ...(nextUrl !== photo.url ? { url: nextUrl ?? photo.url } : {}),
                ...(nextThumbnailUrl !== photo.thumbnailUrl ? { thumbnailUrl: nextThumbnailUrl ?? null } : {}),
            },
        });

        if (nextUrl !== photo.url) {
            updatedPhotoUrls += 1;
        }

        if (nextThumbnailUrl !== photo.thumbnailUrl) {
            updatedPhotoThumbnails += 1;
        }
    }

    const backgrounds = await prisma.backgroundImage.findMany({
        select: {
            id: true,
            url: true,
        },
    });

    let updatedBackgroundUrls = 0;

    for (const background of backgrounds) {
        const nextUrl = rewriteUrl(background.url, virtualHostedHosts, pathStyleHosts);
        if (nextUrl === background.url) {
            continue;
        }

        await prisma.backgroundImage.update({
            where: { id: background.id },
            data: { url: nextUrl ?? background.url },
        });
        updatedBackgroundUrls += 1;
    }

    console.log('Rewrote media URLs to CDN base:');
    console.log(`- photos.url: ${updatedPhotoUrls}`);
    console.log(`- photos.thumbnailUrl: ${updatedPhotoThumbnails}`);
    console.log(`- background_images.url: ${updatedBackgroundUrls}`);
}

main()
    .catch((error) => {
        console.error('Failed to rewrite media URLs:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
