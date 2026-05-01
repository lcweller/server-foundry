CREATE TYPE "public"."backup_destination" AS ENUM('platform', 's3');--> statement-breakpoint
CREATE TYPE "public"."backup_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "backup_configs" (
	"server_id" uuid PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"schedule_cron" text,
	"retention_count" integer DEFAULT 7 NOT NULL,
	"destination_type" "backup_destination" DEFAULT 'platform' NOT NULL,
	"destination_config_json" jsonb,
	"last_run_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"size_bytes" bigint,
	"storage_url" text,
	"status" "backup_status" DEFAULT 'running' NOT NULL,
	"error_message" text,
	"retention_until" timestamp with time zone,
	"triggered_by" text
);
--> statement-breakpoint
ALTER TABLE "backup_configs" ADD CONSTRAINT "backup_configs_server_id_game_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."game_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_server_id_game_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."game_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backups_server_started_idx" ON "backups" USING btree ("server_id","started_at" DESC NULLS LAST);