CREATE TABLE "kroger_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "cart" jsonb;--> statement-breakpoint
ALTER TABLE "kroger_accounts" ADD CONSTRAINT "kroger_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;