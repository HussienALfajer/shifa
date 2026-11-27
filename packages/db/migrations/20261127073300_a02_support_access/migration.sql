CREATE TABLE "support_access_grant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"admin_name" text NOT NULL,
	"reason" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by" uuid,
	"ended_by_name" text,
	"end_reason" text,
	"handoff_token_hash" text,
	"handoff_expires_at" timestamp with time zone,
	CONSTRAINT "support_access_grant_reason_check" CHECK (char_length("reason") between 10 and 500 and "reason" = btrim("reason")),
	CONSTRAINT "support_access_grant_duration_check" CHECK ("expires_at" > "opened_at" and "expires_at" <= "opened_at" + interval '4 hours'),
	CONSTRAINT "support_access_grant_end_check" CHECK (("ended_at" is null) = ("end_reason" is null)
          and ("end_reason" is null or "end_reason" in ('admin', 'owner', 'expiry'))
          and (("end_reason" = 'expiry') = ("end_reason" is not null and "ended_by" is null))
          and ("ended_at" is not null or ("ended_by" is null and "ended_by_name" is null))),
	CONSTRAINT "support_access_grant_names_check" CHECK (char_length("admin_name") between 1 and 200
          and ("ended_by_name" is null or char_length("ended_by_name") between 1 and 200)),
	CONSTRAINT "support_access_grant_handoff_check" CHECK ("handoff_token_hash" is null or "handoff_token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "support_grant_id" uuid;--> statement-breakpoint
CREATE INDEX "session_support_grant_id_idx" ON "session" ("support_grant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_access_grant_tenant_id_admin_user_id_open_key" ON "support_access_grant" ("tenant_id","admin_user_id") WHERE "ended_at" is null;--> statement-breakpoint
CREATE INDEX "support_access_grant_tenant_id_opened_at_idx" ON "support_access_grant" ("tenant_id","opened_at");--> statement-breakpoint
CREATE INDEX "support_access_grant_tenant_id_handoff_token_hash_idx" ON "support_access_grant" ("tenant_id","handoff_token_hash");--> statement-breakpoint
ALTER TABLE "support_access_grant" ADD CONSTRAINT "support_access_grant_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");