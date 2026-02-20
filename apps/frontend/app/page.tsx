import GuestUploader from "@/components/GuestUploader";

export default function Home() {
  // For demo: using a hardcoded event
  // In production, this would come from URL params or user selection
  const DEMO_EVENT_ID = "691b044c-187b-431d-9d00-1924e2000986";
  const DEMO_EVENT_SLUG = "demo-event";

  return (
    <main className="min-h-screen min-h-dvh bg-background flex flex-col items-center justify-center px-4 py-20 sm:p-4">
      {/* Top Brand Bar */}
      <div className="fixed left-0 top-0 w-full z-50 flex justify-center border-b border-border bg-background/80 backdrop-blur-2xl px-4 py-3 sm:py-4">
        <p className="font-bold text-primary text-lg tracking-wide">
          Wedding Memos
        </p>
      </div>

      <div className="z-10 w-full max-w-md flex flex-col items-center gap-6 sm:gap-8">
        <div className="text-center space-y-3 sm:space-y-4">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-primary">
            Welcome to the Party
          </h1>
          <p className="text-sm sm:text-base leading-7 text-muted-foreground">
            Snap a photo or video and see it on the big screen instantly.
          </p>
        </div>

        <GuestUploader eventId={DEMO_EVENT_ID} eventSlug={DEMO_EVENT_SLUG} />
      </div>
    </main>
  );
}
