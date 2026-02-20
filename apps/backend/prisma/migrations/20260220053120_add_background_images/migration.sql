-- CreateTable
CREATE TABLE "background_images" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "background_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "background_images" ADD CONSTRAINT "background_images_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
