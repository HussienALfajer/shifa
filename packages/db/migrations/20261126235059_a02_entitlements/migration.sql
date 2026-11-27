CREATE TABLE "addon" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" text NOT NULL,
	"mode" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addon_key_check" CHECK ("key" ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$'),
	CONSTRAINT "addon_mode_check" CHECK ("mode" in ('replace', 'increment')),
	CONSTRAINT "addon_value_check" CHECK (jsonb_typeof("value") = 'boolean' or (jsonb_typeof("value") = 'number' and ("value")::numeric >= 0 and ("value")::numeric = trunc(("value")::numeric)))
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"type" text NOT NULL CONSTRAINT "plan_type_key" UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_type_check" CHECK ("type" in ('solo', 'multi_doctor', 'multi_branch'))
);
--> statement-breakpoint
CREATE TABLE "plan_feature" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"plan_type" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "plan_feature_plan_type_key_key" UNIQUE("plan_type","key"),
	CONSTRAINT "plan_feature_key_check" CHECK ("key" ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$'),
	CONSTRAINT "plan_feature_value_check" CHECK (jsonb_typeof("value") = 'boolean' or (jsonb_typeof("value") = 'number' and ("value")::numeric >= 0 and ("value")::numeric = trunc(("value")::numeric)))
);
--> statement-breakpoint
CREATE TABLE "tenant_addon" (
	"tenant_id" uuid,
	"addon_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_addon_pkey" PRIMARY KEY("tenant_id","addon_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone,
	"set_by" uuid NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_override_tenant_id_key_key" UNIQUE("tenant_id","key"),
	CONSTRAINT "tenant_override_key_check" CHECK ("key" ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$'),
	CONSTRAINT "tenant_override_value_check" CHECK (jsonb_typeof("value") = 'boolean' or (jsonb_typeof("value") = 'number' and ("value")::numeric >= 0 and ("value")::numeric = trunc(("value")::numeric))),
	CONSTRAINT "tenant_override_reason_check" CHECK (char_length(btrim("reason")) between 10 and 500)
);
--> statement-breakpoint
CREATE TABLE "tenant_override_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"by" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_override_event_key_check" CHECK ("key" ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$'),
	CONSTRAINT "tenant_override_event_kind_check" CHECK ("kind" in ('set', 'changed', 'removed', 'type_changed'))
);
--> statement-breakpoint
CREATE INDEX "tenant_override_event_tenant_id_key_at_idx" ON "tenant_override_event" ("tenant_id","key","at");--> statement-breakpoint
ALTER TABLE "plan_feature" ADD CONSTRAINT "plan_feature_plan_type_plan_type_fkey" FOREIGN KEY ("plan_type") REFERENCES "plan"("type");--> statement-breakpoint
ALTER TABLE "tenant_addon" ADD CONSTRAINT "tenant_addon_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "tenant_addon" ADD CONSTRAINT "tenant_addon_addon_id_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "addon"("id");--> statement-breakpoint
ALTER TABLE "tenant_override" ADD CONSTRAINT "tenant_override_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "tenant_override_event" ADD CONSTRAINT "tenant_override_event_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");