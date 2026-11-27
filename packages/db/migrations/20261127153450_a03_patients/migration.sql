CREATE TABLE "patient" (
	"tenant_id" uuid,
	"id" uuid,
	"file_number" integer NOT NULL,
	"previous_file_number" text,
	"given_name" text NOT NULL,
	"father_name" text,
	"family_name" text,
	"mother_name" text,
	"contact_phone" text NOT NULL,
	"second_phone" text,
	"sex" text NOT NULL,
	"birth_date" date NOT NULL,
	"birth_date_estimated" boolean DEFAULT false NOT NULL,
	"registered_branch_id" uuid,
	"state" text DEFAULT 'active' NOT NULL,
	"merged_into_id" uuid,
	"relation" text,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"create_hash" text NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_pkey" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "patient_tenant_id_file_number_key" UNIQUE("tenant_id","file_number"),
	CONSTRAINT "patient_tenant_id_previous_file_number_key" UNIQUE("tenant_id","previous_file_number"),
	CONSTRAINT "patient_file_number_check" CHECK ("file_number" >= 1),
	CONSTRAINT "patient_previous_file_number_check" CHECK (char_length("previous_file_number") between 1 and 40 and "previous_file_number" = btrim("previous_file_number")),
	CONSTRAINT "patient_given_name_check" CHECK (char_length("given_name") between 1 and 40 and "given_name" = btrim("given_name")),
	CONSTRAINT "patient_father_name_check" CHECK (char_length("father_name") between 1 and 40 and "father_name" = btrim("father_name")),
	CONSTRAINT "patient_family_name_check" CHECK (char_length("family_name") between 1 and 40 and "family_name" = btrim("family_name")),
	CONSTRAINT "patient_mother_name_check" CHECK (char_length("mother_name") between 1 and 40 and "mother_name" = btrim("mother_name")),
	CONSTRAINT "patient_contact_phone_check" CHECK ("contact_phone" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "patient_second_phone_check" CHECK ("second_phone" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "patient_sex_check" CHECK ("sex" in ('male', 'female')),
	CONSTRAINT "patient_state_check" CHECK ("state" in ('active', 'archived', 'merged')),
	CONSTRAINT "patient_merged_check" CHECK (("state" = 'merged') = ("merged_into_id" is not null) and "merged_into_id" is distinct from "id"),
	CONSTRAINT "patient_archived_check" CHECK (("state" = 'archived') = ("archived_at" is not null) and ("archived_at" is null) = ("archived_by" is null)),
	CONSTRAINT "patient_relation_check" CHECK ("relation" ~ '^[a-z][a-z_]{0,31}$'),
	CONSTRAINT "patient_create_hash_check" CHECK ("create_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "patient_updated_at_check" CHECK ("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "patient_file_counter" (
	"tenant_id" uuid PRIMARY KEY,
	"next" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_file_counter_next_check" CHECK ("next" >= 1)
);
--> statement-breakpoint
ALTER TABLE "patient" ADD CONSTRAINT "patient_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "patient" ADD CONSTRAINT "patient_registered_branch_fk" FOREIGN KEY ("tenant_id","registered_branch_id") REFERENCES "branch"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "patient" ADD CONSTRAINT "patient_merged_into_fk" FOREIGN KEY ("tenant_id","merged_into_id") REFERENCES "patient"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "patient_file_counter" ADD CONSTRAINT "patient_file_counter_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");