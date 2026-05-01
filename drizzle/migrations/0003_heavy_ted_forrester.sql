CREATE TYPE "public"."server_status" AS ENUM('deploying', 'running', 'stopped', 'crashed', 'deleting');--> statement-breakpoint
CREATE TABLE "game_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"steam_app_id" integer,
	"default_port" integer NOT NULL,
	"min_ram_mb" integer,
	"rec_ram_mb" integer,
	"config_schema_json" jsonb,
	"logo_url" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_catalog_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "game_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"name" text NOT NULL,
	"port" integer NOT NULL,
	"config_json" jsonb,
	"status" "server_status" DEFAULT 'deploying' NOT NULL,
	"pid" integer,
	"player_count" integer DEFAULT 0 NOT NULL,
	"max_players" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_started_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "game_servers" ADD CONSTRAINT "game_servers_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_servers" ADD CONSTRAINT "game_servers_game_id_game_catalog_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_servers_host_id_idx" ON "game_servers" USING btree ("host_id");