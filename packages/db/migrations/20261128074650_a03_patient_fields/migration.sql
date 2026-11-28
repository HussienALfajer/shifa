CREATE TABLE "patient_field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"label_en" text,
	"type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"rules" jsonb NOT NULL,
	"section" text NOT NULL,
	"position" integer NOT NULL,
	"view_roles" text[] NOT NULL,
	"edit_roles" text[] NOT NULL,
	"sensitive" boolean DEFAULT false NOT NULL,
	"searchable" boolean DEFAULT false NOT NULL,
	"print" boolean DEFAULT false NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_field_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "patient_field_tenant_id_key_key" UNIQUE("tenant_id","key"),
	CONSTRAINT "patient_field_tenant_id_number_key" UNIQUE("tenant_id","number"),
	CONSTRAINT "patient_field_number_check" CHECK ("number" between 1 and 999999),
	CONSTRAINT "patient_field_key_check" CHECK ("key" = 'cf_' || "number"::text),
	CONSTRAINT "patient_field_label_check" CHECK (char_length("label") between 1 and 60 and "label" = btrim("label")),
	CONSTRAINT "patient_field_label_en_check" CHECK (char_length("label_en") between 1 and 60 and "label_en" = btrim("label_en")),
	CONSTRAINT "patient_field_type_check" CHECK ("type" in ('text', 'long_text', 'number', 'date', 'single_choice', 'multi_choice', 'yes_no', 'phone')),
	CONSTRAINT "patient_field_rules_check" CHECK (jsonb_typeof("rules") = 'object' and jsonb_typeof("rules" -> 'validation') = 'object' and "rules" ? 'default' and octet_length("rules"::text) <= 16384),
	CONSTRAINT "patient_field_section_check" CHECK (char_length("section") between 1 and 40 and "section" = btrim("section")),
	CONSTRAINT "patient_field_position_check" CHECK ("position" between 0 and 999),
	CONSTRAINT "patient_field_roles_check" CHECK (cardinality("view_roles") between 1 and 5 and "view_roles" <@ array['owner', 'doctor', 'receptionist', 'assistant', 'accountant']::text[] and "edit_roles" <@ "view_roles"),
	CONSTRAINT "patient_field_sensitive_check" CHECK (not ("sensitive" and "searchable")),
	CONSTRAINT "patient_field_state_check" CHECK ("state" in ('active', 'archived', 'purged')),
	CONSTRAINT "patient_field_archived_check" CHECK (("state" = 'active') = ("archived_at" is null) and ("state" = 'purged') = ("purged_at" is not null)),
	CONSTRAINT "patient_field_updated_at_check" CHECK ("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "patient_field_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_field_option_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "patient_field_option_label_check" CHECK (char_length("label") between 1 and 60 and "label" = btrim("label")),
	CONSTRAINT "patient_field_option_position_check" CHECK ("position" between 0 and 999)
);
--> statement-breakpoint
CREATE INDEX "patient_field_tenant_id_state_idx" ON "patient_field" ("tenant_id","state");--> statement-breakpoint
CREATE INDEX "patient_field_option_tenant_id_field_id_idx" ON "patient_field_option" ("tenant_id","field_id");--> statement-breakpoint
ALTER TABLE "patient_field" ADD CONSTRAINT "patient_field_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "patient_field_option" ADD CONSTRAINT "patient_field_option_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "patient_field_option" ADD CONSTRAINT "patient_field_option_field_fk" FOREIGN KEY ("tenant_id","field_id") REFERENCES "patient_field"("tenant_id","id");