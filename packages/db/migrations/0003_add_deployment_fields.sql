-- Add deployment fields to projects table
ALTER TABLE "projects" ADD COLUMN "deployment_platform" text DEFAULT 'github-pages';
ALTER TABLE "projects" ADD COLUMN "deployment_status" text;
ALTER TABLE "projects" ADD COLUMN "deployment_url" text;
ALTER TABLE "projects" ADD COLUMN "last_deployed_at" timestamp;
ALTER TABLE "projects" ADD COLUMN "last_deployment_commit" text;
ALTER TABLE "projects" ADD COLUMN "auto_deploy_on_save" boolean DEFAULT false NOT NULL;
ALTER TABLE "projects" ADD COLUMN "custom_domain" text;

-- Create deployments table for tracking deployment history
CREATE TABLE IF NOT EXISTS "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" text NOT NULL,
	"commit_sha" text,
	"commit_message" text,
	"deployment_url" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

-- Add foreign key constraint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
