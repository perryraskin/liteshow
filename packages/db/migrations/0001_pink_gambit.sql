ALTER TABLE "projects" ALTER COLUMN "github_repo_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "github_repo_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "github_auth_type" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "github_installation_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "github_repo_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_public_repo_scope" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_private_repo_scope" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "scopes_granted_at" timestamp;