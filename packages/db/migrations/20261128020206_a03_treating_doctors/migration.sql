CREATE TABLE "patient_treating_doctor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"added_by" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_treating_doctor_chart_member_key" UNIQUE("tenant_id","patient_id","member_id")
);
--> statement-breakpoint
CREATE INDEX "patient_tenant_id_contact_phone_idx" ON "patient" ("tenant_id","contact_phone");--> statement-breakpoint
CREATE INDEX "patient_treating_doctor_tenant_id_member_id_idx" ON "patient_treating_doctor" ("tenant_id","member_id");--> statement-breakpoint
ALTER TABLE "patient_treating_doctor" ADD CONSTRAINT "patient_treating_doctor_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "patient_treating_doctor" ADD CONSTRAINT "patient_treating_doctor_patient_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "patient"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "patient_treating_doctor" ADD CONSTRAINT "patient_treating_doctor_member_fk" FOREIGN KEY ("tenant_id","member_id") REFERENCES "membership"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "patient" ADD CONSTRAINT "patient_relation_value_check" CHECK ("relation" in ('holder', 'son', 'daughter', 'husband', 'wife', 'father', 'mother', 'brother', 'sister', 'other'));