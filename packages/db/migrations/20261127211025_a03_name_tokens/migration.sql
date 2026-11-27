CREATE TABLE "patient_name_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"part" smallint NOT NULL,
	"word" smallint NOT NULL,
	"token" text NOT NULL,
	"whole" boolean NOT NULL,
	"key_version" smallint NOT NULL,
	CONSTRAINT "patient_name_token_chart_key" UNIQUE("tenant_id","patient_id","part","word","token"),
	CONSTRAINT "patient_name_token_part_check" CHECK ("part" between 0 and 2),
	CONSTRAINT "patient_name_token_word_check" CHECK ("word" between 0 and 40),
	CONSTRAINT "patient_name_token_token_check" CHECK (char_length("token") between 1 and 24),
	CONSTRAINT "patient_name_token_key_version_check" CHECK ("key_version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "name_key" text;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "name_key_version" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "contact_phone_tail" text GENERATED ALWAYS AS (right(contact_phone, 7)) STORED;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "second_phone_tail" text GENERATED ALWAYS AS (right(second_phone, 7)) STORED;--> statement-breakpoint
CREATE INDEX "patient_tenant_id_contact_phone_tail_idx" ON "patient" ("tenant_id","contact_phone_tail");--> statement-breakpoint
CREATE INDEX "patient_tenant_id_second_phone_tail_idx" ON "patient" ("tenant_id","second_phone_tail");--> statement-breakpoint
CREATE INDEX "patient_tenant_id_name_key_version_idx" ON "patient" ("tenant_id","name_key_version");--> statement-breakpoint
CREATE INDEX "patient_name_token_tenant_id_token_idx" ON "patient_name_token" ("tenant_id","token","whole","patient_id");--> statement-breakpoint
ALTER TABLE "patient_name_token" ADD CONSTRAINT "patient_name_token_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "patient_name_token" ADD CONSTRAINT "patient_name_token_patient_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "patient"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "patient" ADD CONSTRAINT "patient_name_key_check" CHECK (char_length("name_key") <= 200 and ("name_key" is null) = ("name_key_version" = 0));--> statement-breakpoint
ALTER TABLE "patient" ADD CONSTRAINT "patient_name_key_version_check" CHECK ("name_key_version" >= 0);