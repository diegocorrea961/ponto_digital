CREATE TYPE "public"."punch_source" AS ENUM('CLOCK', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."punch_type" AS ENUM('ENTRY', 'LUNCH_OUT', 'LUNCH_IN', 'EXIT');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'EMPLOYEE');--> statement-breakpoint
CREATE TABLE "punches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "punch_type" NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"work_date" date NOT NULL,
	"source" "punch_source" DEFAULT 'CLOCK' NOT NULL,
	"note" text,
	"created_by_id" uuid,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"voided_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'EMPLOYEE' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "punches" ADD CONSTRAINT "punches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "punches_user_date_idx" ON "punches" USING btree ("user_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "punches_one_active_per_type_idx" ON "punches" USING btree ("user_id","work_date","type") WHERE "punches"."voided_at" is null;