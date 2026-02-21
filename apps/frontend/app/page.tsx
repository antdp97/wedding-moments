import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Camera, Tv, ArrowRight, Shield } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen min-h-dvh bg-background flex flex-col items-center justify-center px-4 py-20">
      <div className="z-10 w-full max-w-2xl flex flex-col items-center gap-10">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex flex-col items-center justify-center mb-6">
            <Camera className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-primary">
            Wedding Memos
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto">
            The instant photo sharing experience for events.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg mt-4">
          <div className="flex flex-col items-center justify-center p-8 bg-card rounded-2xl border border-border/50 shadow-sm text-center">
            <Camera className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-bold text-lg mb-1">Are you a Guest?</h3>
            <p className="text-sm text-muted-foreground mb-4">Scan the QR code at your event to start uploading photos!</p>
          </div>

          <div className="flex flex-col items-center justify-center p-8 bg-card rounded-2xl border border-border/50 shadow-sm text-center">
            <Shield className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-bold text-lg mb-1">Host an Event?</h3>
            <p className="text-sm text-muted-foreground mb-4">Manage your event galleries and live screens.</p>
            <Link href="/admin">
              <Button variant="outline" size="sm" className="w-full">
                Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
