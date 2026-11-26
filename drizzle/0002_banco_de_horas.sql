CREATE TYPE "public"."day_off_kind" AS ENUM('HOLIDAY', 'EXCUSED');--> statement-breakpoint
CREATE TABLE "day_offs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"kind" "day_off_kind" NOT NULL,
	"reason" text NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "work_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"days" jsonb NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deactivated_on" date;--> statement-breakpoint
ALTER TABLE "day_offs" ADD CONSTRAINT "day_offs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "day_offs_user_idx" ON "day_offs" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE INDEX "work_schedules_user_idx" ON "work_schedules" USING btree ("user_id","valid_from");