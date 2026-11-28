CREATE TABLE "patient_field_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"search_key" text,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_field_value_chart_field_key" UNIQUE("tenant_id","patient_id","field_id"),
	CONSTRAINT "patient_field_value_value_check" CHECK (jsonb_typeof("value") in ('string', 'number', 'boolean', 'array') and pg_column_size("value") <= 16384),
	CONSTRAINT "patient_field_value_search_key_check" CHECK (char_length("search_key") between 1 and 100)
);
--> statement-breakpoint
CREATE INDEX "patient_field_value_tenant_id_search_idx" ON "patient_field_value" ("tenant_id","field_id","search_key") WHERE "search_key" is not null;--> statement-breakpoint
CREATE INDEX "patient_field_value_tenant_id_field_id_idx" ON "patient_field_value" ("tenant_id","field_id");--> statement-breakpoint
ALTER TABLE "patient_field_value" ADD CONSTRAINT "patient_field_value_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "patient_field_value" ADD CONSTRAINT "patient_field_value_patient_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "patient"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "patient_field_value" ADD CONSTRAINT "patient_field_value_field_fk" FOREIGN KEY ("tenant_id","field_id") REFERENCES "patient_field"("tenant_id","id");