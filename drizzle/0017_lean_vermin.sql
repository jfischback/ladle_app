CREATE TABLE "care_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caregiver_household_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "care_links" ADD CONSTRAINT "care_links_household_id_users_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;