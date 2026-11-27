CREATE TABLE "announcement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"body" text NOT NULL,
	"level" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"target" text NOT NULL,
	"ended_early" boolean DEFAULT false NOT NULL,
	"ended_by" uuid,
	"ended_by_name" text,
	"created_by" uuid NOT NULL,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_body_check" CHECK (char_length(btrim("body")) between 1 and 280),
	CONSTRAINT "announcement_level_check" CHECK ("level" in ('info', 'warning')),
	CONSTRAINT "announcement_target_check" CHECK ("target" in ('all', 'selected')),
	CONSTRAINT "announcement_version_check" CHECK ("version" >= 1),
	CONSTRAINT "announcement_ended_by_check" CHECK (("ended_early" and "ended_by" is not null and "ends_at" is not null)
          or (not "ended_early" and "ended_by" is null))
);
--> statement-breakpoint
CREATE TABLE "announcement_dismissal" (
	"user_id" uuid,
	"announcement_id" uuid,
	"version" integer NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_dismissal_pkey" PRIMARY KEY("user_id","announcement_id"),
	CONSTRAINT "announcement_dismissal_version_check" CHECK ("version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "announcement_target" (
	"tenant_id" uuid,
	"announcement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_target_pkey" PRIMARY KEY("tenant_id","announcement_id")
);
--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"day" date NOT NULL,
	"key" text NOT NULL,
	"value" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_daily_tenant_id_day_key_key" UNIQUE("tenant_id","day","key"),
	CONSTRAINT "usage_daily_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]{0,63}$'),
	CONSTRAINT "usage_daily_value_check" CHECK ("value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "last_sign_in_on" date;--> statement-breakpoint
CREATE INDEX "announcement_starts_at_idx" ON "announcement" ("starts_at");--> statement-breakpoint
CREATE INDEX "announcement_dismissal_announcement_id_idx" ON "announcement_dismissal" ("announcement_id");--> statement-breakpoint
ALTER TABLE "announcement_dismissal" ADD CONSTRAINT "announcement_dismissal_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "announcement_dismissal" ADD CONSTRAINT "announcement_dismissal_announcement_id_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcement"("id");--> statement-breakpoint
ALTER TABLE "announcement_target" ADD CONSTRAINT "announcement_target_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");--> statement-breakpoint
ALTER TABLE "announcement_target" ADD CONSTRAINT "announcement_target_announcement_id_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcement"("id");--> statement-breakpoint
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_tenant_id_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id");