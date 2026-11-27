CREATE TABLE "feature_flag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" text NOT NULL CONSTRAINT "feature_flag_key_key" UNIQUE,
	"mode" text NOT NULL,
	"reason" text NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flag_key_check" CHECK ("key" ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$'),
	CONSTRAINT "feature_flag_mode_check" CHECK ("mode" in ('off', 'on', 'selected')),
	CONSTRAINT "feature_flag_reason_check" CHECK (char_length(btrim("reason")) between 10 and 500)
);
--> statement-breakpoint
CREATE TABLE "feature_flag_tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"flag_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flag_tenant_tenant_id_flag_key_key" UNIQUE("tenant_id","flag_key")
);
--> statement-breakpoint
ALTER TABLE "feature_flag_tenant" ADD CONSTRAINT "feature_flag_tenant_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "feature_flag_tenant" ADD CONSTRAINT "feature_flag_tenant_flag_key_feature_flag_key_fkey" FOREIGN KEY ("flag_key") REFERENCES "feature_flag"("key");