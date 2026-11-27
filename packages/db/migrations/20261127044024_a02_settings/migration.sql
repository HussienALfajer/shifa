CREATE TABLE "platform_setting_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope" text NOT NULL,
	"plan_type" text,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_setting_value_scope_plan_type_key_key" UNIQUE NULLS NOT DISTINCT("scope","plan_type","key"),
	CONSTRAINT "platform_setting_value_key_check" CHECK ("key" ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$'),
	CONSTRAINT "platform_setting_value_scope_check" CHECK ("scope" in ('platform', 'plan')),
	CONSTRAINT "platform_setting_value_plan_check" CHECK (("scope" = 'plan') = ("plan_type" is not null)),
	CONSTRAINT "platform_setting_value_plan_type_check" CHECK ("plan_type" is null or "plan_type" in ('solo', 'multi_doctor', 'multi_branch'))
);
--> statement-breakpoint
CREATE TABLE "setting_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"scope_id" uuid,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"set_by" uuid,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "setting_value_tenant_id_scope_scope_id_key_key" UNIQUE NULLS NOT DISTINCT("tenant_id","scope","scope_id","key"),
	CONSTRAINT "setting_value_key_check" CHECK ("key" ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$'),
	CONSTRAINT "setting_value_scope_check" CHECK ("scope" in ('organization', 'branch', 'practitioner', 'user')),
	CONSTRAINT "setting_value_scope_id_check" CHECK (("scope" = 'organization') = ("scope_id" is null))
);
--> statement-breakpoint
ALTER TABLE "setting_value" ADD CONSTRAINT "setting_value_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");