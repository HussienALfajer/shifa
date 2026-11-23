CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid,
	"actor_id" uuid,
	"target_id" uuid,
	"event" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text,
	"data" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "audit_event_event_check" CHECK ("event" ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$'),
	CONSTRAINT "audit_event_request_id_check" CHECK ("request_id" ~ '^[A-Za-z0-9._:-]{1,64}$'),
	CONSTRAINT "audit_event_data_check" CHECK (jsonb_typeof("data") = 'object' and octet_length("data"::text) <= 1024)
);
--> statement-breakpoint
CREATE TABLE "auth_throttle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"kind" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "auth_throttle_kind_key_hash_key" UNIQUE("kind","key_hash"),
	CONSTRAINT "auth_throttle_kind_check" CHECK ("kind" in ('phone', 'ip')),
	CONSTRAINT "auth_throttle_key_hash_check" CHECK ("key_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "auth_throttle_failures_check" CHECK ("failures" >= 0)
);
--> statement-breakpoint
CREATE TABLE "branch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "branch_name_check" CHECK (char_length(btrim("name")) between 1 and 200),
	CONSTRAINT "branch_phone_check" CHECK ("phone" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "deployment_route" (
	"tenant_id" uuid PRIMARY KEY,
	"database_key" text DEFAULT 'primary' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deployment_route_database_key_check" CHECK ("database_key" ~ '^[a-z][a-z0-9_]{0,62}$')
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"phone_e164" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "membership_tenant_id_phone_e164_key" UNIQUE("tenant_id","phone_e164"),
	CONSTRAINT "membership_tenant_id_user_id_key" UNIQUE("tenant_id","user_id"),
	CONSTRAINT "membership_phone_e164_check" CHECK ("phone_e164" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "membership_display_name_check" CHECK (char_length(btrim("display_name")) between 1 and 200),
	CONSTRAINT "membership_status_check" CHECK ("status" in ('pending', 'active', 'deactivated'))
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL CONSTRAINT "organization_tenant_id_key" UNIQUE,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_name_check" CHECK (char_length(btrim("name")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "permission_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"key" text NOT NULL,
	"granted" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_override_tenant_id_membership_id_key_key" UNIQUE("tenant_id","membership_id","key"),
	CONSTRAINT "permission_override_key_check" CHECK ("key" ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)+$')
);
--> statement-breakpoint
CREATE TABLE "role_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"role" text NOT NULL,
	"branch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_assignment_tenant_id_membership_id_role_branch_id_key" UNIQUE NULLS NOT DISTINCT("tenant_id","membership_id","role","branch_id"),
	CONSTRAINT "role_assignment_role_check" CHECK ("role" in ('owner', 'doctor', 'receptionist', 'assistant', 'accountant'))
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL CONSTRAINT "session_token_key" UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"active_tenant_id" uuid,
	"active_branch_id" uuid,
	"last_active_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "setup_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"replaced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "setup_link_purpose_check" CHECK ("purpose" in ('owner_setup', 'member_setup', 'invitation')),
	CONSTRAINT "setup_link_token_hash_check" CHECK ("token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"subscription_end" date,
	"idle_minutes" smallint DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_name_check" CHECK (char_length(btrim("name")) between 1 and 200),
	CONSTRAINT "tenant_type_check" CHECK ("type" in ('solo', 'multi_doctor', 'multi_branch')),
	CONSTRAINT "tenant_status_check" CHECK ("status" in ('trial', 'active', 'suspended')),
	CONSTRAINT "tenant_idle_minutes_check" CHECK ("idle_minutes" in (15, 30, 60))
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" uuid NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"email" text NOT NULL CONSTRAINT "user_email_key" UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"phone_number" text CONSTRAINT "user_phone_number_key" UNIQUE,
	"phone_number_verified" boolean,
	"two_factor_enabled" boolean DEFAULT false,
	CONSTRAINT "user_phone_number_check" CHECK ("phone_number" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "audit_event_tenant_id_at_idx" ON "audit_event" ("tenant_id","at");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "setup_link_tenant_id_token_hash_idx" ON "setup_link" ("tenant_id","token_hash");--> statement-breakpoint
CREATE INDEX "setup_link_tenant_id_membership_id_idx" ON "setup_link" ("tenant_id","membership_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "two_factor" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "deployment_route" ADD CONSTRAINT "deployment_route_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "permission_override" ADD CONSTRAINT "permission_override_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "permission_override" ADD CONSTRAINT "permission_override_membership_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "membership"("tenant_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_membership_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "membership"("tenant_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_branch_fk" FOREIGN KEY ("tenant_id","branch_id") REFERENCES "branch"("tenant_id","id");--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_active_tenant_id_tenant_id_fkey" FOREIGN KEY ("active_tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "setup_link" ADD CONSTRAINT "setup_link_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "setup_link" ADD CONSTRAINT "setup_link_membership_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "membership"("tenant_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;