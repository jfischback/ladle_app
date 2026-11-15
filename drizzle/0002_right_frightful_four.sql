CREATE TABLE "cooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"site_url" text NOT NULL,
	"feed_url" text NOT NULL,
	"feed_kind" text NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_error" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "found_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cook_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"image_url" text,
	"published_at" timestamp with time zone,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_minutes" integer,
	"servings" integer,
	"status" text DEFAULT 'new' NOT NULL,
	"recipe_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "trial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cooks" ADD CONSTRAINT "cooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_recipes" ADD CONSTRAINT "found_recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_recipes" ADD CONSTRAINT "found_recipes_cook_id_cooks_id_fk" FOREIGN KEY ("cook_id") REFERENCES "public"."cooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cooks_user_idx" ON "cooks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "found_user_url_idx" ON "found_recipes" USING btree ("user_id","url");