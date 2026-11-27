CREATE TABLE "area" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"city_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "area_city_id_name_key_key" UNIQUE("city_id","name_key"),
	CONSTRAINT "area_id_city_id_key" UNIQUE("id","city_id"),
	CONSTRAINT "area_name_check" CHECK (char_length(btrim("name")) between 1 and 100),
	CONSTRAINT "area_name_key_check" CHECK (char_length("name_key") between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "city" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"name_key" text NOT NULL CONSTRAINT "city_name_key_key" UNIQUE,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_name_check" CHECK (char_length(btrim("name")) between 1 and 100),
	CONSTRAINT "city_name_key_check" CHECK (char_length("name_key") between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "tenant" DROP CONSTRAINT "tenant_idle_minutes_check";--> statement-breakpoint
ALTER TABLE "branch" ADD COLUMN "city_id" uuid;--> statement-breakpoint
ALTER TABLE "branch" ADD COLUMN "area_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant" DROP COLUMN "idle_minutes";--> statement-breakpoint
CREATE INDEX "branch_tenant_id_city_id_idx" ON "branch" ("tenant_id","city_id");--> statement-breakpoint
CREATE INDEX "branch_tenant_id_area_id_idx" ON "branch" ("tenant_id","area_id");--> statement-breakpoint
ALTER TABLE "area" ADD CONSTRAINT "area_city_id_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "city"("id");--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_city_id_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "city"("id");--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_area_fk" FOREIGN KEY ("area_id","city_id") REFERENCES "area"("id","city_id");--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_area_needs_city" CHECK ("area_id" is null or "city_id" is not null);