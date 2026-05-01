CREATE TYPE "public"."agent_update_status" AS ENUM('running', 'completed', 'failed', 'rolled_back');--> statement-breakpoint
CREATE TABLE "agent_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"from_version" text,
	"to_version" text NOT NULL,
	"download_url" text NOT NULL,
	"status" "agent_update_status" DEFAULT 'running' NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_updates" ADD CONSTRAINT "agent_updates_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_updates_host_started_idx" ON "agent_updates" USING btree ("host_id","started_at" DESC NULLS LAST);