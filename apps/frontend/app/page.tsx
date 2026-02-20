import GuestUploader from "@/components/GuestUploader";

export default function Home() {
  // For demo: using a hardcoded event
  // In production, this would come from URL params or user selection
  const DEMO_EVENT_ID = "691b044c-187b-431d-9d00-1924e2000986";
  const DEMO_EVENT_SLUG = "demo-event";

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex absolute top-4 left-4">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-border bg-background/50 pb-6 pt-8 backdrop-blur-2xl lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-muted lg:p-4 font-bold text-primary">
          LiveEvent&nbsp;
          <span className="font-light">Alpha</span>
        </p>
      </div>

      <div className="z-10 w-full max-w-md items-center justify-center font-mono text-sm lg:flex flex-col gap-8">
        <div className="text-center space-y-4 mb-4">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-primary font-serif">
            Welcome to the Party
          </h1>
          <p className="leading-7 [&:not(:first-child)]:mt-6 text-muted-foreground">
            Snap a photo or video and see it on the big screen instantly.
          </p>
        </div>

        <GuestUploader eventId={DEMO_EVENT_ID} eventSlug={DEMO_EVENT_SLUG} />
      </div>
    </main>
  );
}
