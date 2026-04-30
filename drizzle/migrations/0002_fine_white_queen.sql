CREATE TABLE "host_metrics_hourly" (
	"host_id" uuid NOT NULL,
	"hour_bucket" timestamp with time zone NOT NULL,
	"samples" integer DEFAULT 0 NOT NULL,
	"cpu_avg" real,
	"cpu_max" real,
	"mem_avg_bytes" bigint,
	"mem_max_bytes" bigint,
	"disk_used_bytes" bigint,
	"net_in_bytes" bigint,
	"net_out_bytes" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "host_metrics_hourly_host_id_hour_bucket_pk" PRIMARY KEY("host_id","hour_bucket")
);
--> statement-breakpoint
ALTER TABLE "host_metrics_hourly" ADD CONSTRAINT "host_metrics_hourly_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "host_metrics_hourly_host_hour_idx" ON "host_metrics_hourly" USING btree ("host_id","hour_bucket");