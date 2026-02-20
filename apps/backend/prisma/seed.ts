import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create demo user
    const passwordHash = await bcrypt.hash('admin123', 10);

    const user = await prisma.user.upsert({
        where: { email: 'admin@weddingmemos.com' },
        update: {},
        create: {
            email: 'admin@weddingmemos.com',
            passwordHash,
        },
    });

    console.log('✅ Created user:', user.email);

    // Create demo event
    const event = await prisma.event.upsert({
        where: { slug: 'demo-event' },
        update: {},
        create: {
            id: '691b044c-187b-431d-9d00-1924e2000986', // Match the frontend hardcoded ID
            slug: 'demo-event',
            name: 'Demo Event',
            hostId: user.id,
            settings: { autoApprove: true, theme: 'dark' },
            isActive: true,
        },
    });

    console.log('✅ Created event:', event.slug);
    console.log('\n🎉 Seed completed successfully!');
    console.log('\nEvent Details:');
    console.log('  - ID:', event.id);
    console.log('  - Slug:', event.slug);
    console.log('  - Upload URL: http://localhost:3000');
    console.log('  - Live Wall: http://localhost:3000/live/demo-event');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
