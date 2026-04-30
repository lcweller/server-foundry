CREATE TYPE "public"."host_status" AS ENUM('online', 'offline', 'connecting', 'updating');--> statement-breakpoint
CREATE TABLE "hosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"hostname" text,
	"ip" text,
	"os" text,
	"kernel" text,
	"cpu_model" text,
	"cpu_cores" integer,
	"ram_bytes" bigint,
	"storage_bytes" bigint,
	"gpu_model" text,
	"agent_version" text,
	"agent_token_hash" text,
	"status" "host_status" DEFAULT 'offline' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pairing_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" uuid NOT NULL,
	"host_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pairing_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "hosts" ADD CONSTRAINT "hosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hosts_user_id_idx" ON "hosts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pairing_codes_expires_at_idx" ON "pairing_codes" USING btree ("expires_at");