CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"address" text NOT NULL,
	"address_hash" text NOT NULL,
	"risk_score" integer NOT NULL,
	"risk_tier" text NOT NULL,
	"confidence" integer NOT NULL,
	"window" jsonb NOT NULL,
	"report_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"logging_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"address" text NOT NULL,
	"address_hash" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_user_id_user_settings_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_settings"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_reports_user_address_created_at_idx" ON "saved_reports" USING btree ("user_id","address_hash","created_at");--> statement-breakpoint
CREATE INDEX "saved_reports_user_created_at_idx" ON "saved_reports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "watchlist_user_address_created_at_idx" ON "watchlist_items" USING btree ("user_id","address_hash","created_at");--> statement-breakpoint
CREATE INDEX "watchlist_user_created_at_idx" ON "watchlist_items" USING btree ("user_id","created_at");
