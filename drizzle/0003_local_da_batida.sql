CREATE TYPE "public"."location_check" AS ENUM('NETWORK', 'GPS', 'OUTSIDE', 'UNCONFIRMED');--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"radius_meters" integer DEFAULT 100 NOT NULL,
	"networks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "punches" ADD COLUMN "location_check" "location_check";--> statement-breakpoint
ALTER TABLE "punches" ADD COLUMN "distance_meters" integer;--> statement-breakpoint
ALTER TABLE "punches" ADD COLUMN "accuracy_meters" integer;