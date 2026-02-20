import LiveWall from "@/components/LiveWall";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function LiveWallPage({ params }: PageProps) {
    const { slug } = await params;
    return <LiveWall eventSlug={slug} />;
}
