CREATE TYPE "public"."log_severity" AS ENUM('debug', 'info', 'warn', 'error');--> statement-breakpoint
CREATE TABLE "game_server_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"server_id" uuid NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"severity" "log_severity" NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "host_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"host_id" uuid NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"severity" "log_severity" NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_server_logs" ADD CONSTRAINT "game_server_logs_server_id_game_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."game_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_logs" ADD CONSTRAINT "host_logs_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_server_logs_server_ts_idx" ON "game_server_logs" USING btree ("server_id","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "host_logs_host_ts_idx" ON "host_logs" USING btree ("host_id","ts" DESC NULLS LAST);