CREATE TABLE "extra_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"mode" text DEFAULT 'on-sale' NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"sale_qty" integer,
	"any_brand" boolean DEFAULT false NOT NULL,
	"servings" integer,
	"status" text DEFAULT 'have' NOT NULL,
	"last_picked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "extras" jsonb;--> statement-breakpoint
ALTER TABLE "extra_items" ADD CONSTRAINT "extra_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "extra_user_cat_name_idx" ON "extra_items" USING btree ("user_id","category","name");