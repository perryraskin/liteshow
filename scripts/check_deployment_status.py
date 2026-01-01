#!/usr/bin/env python3
"""
Check deployment status for a project
Usage: python check_deployment_status.py <project_id>
"""

import sys
import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def check_deployment_status(project_id):
    """Query project deployment status"""

    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL not found in .env file")
        sys.exit(1)

    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()

        # Query project
        cur.execute("""
            SELECT id, name, deployment_status, deployment_url, last_deployed_at
            FROM projects
            WHERE id = %s
        """, (project_id,))

        project = cur.fetchone()

        if not project:
            print(f"Project not found: {project_id}")
        else:
            proj_id, name, deployment_status, deployment_url, last_deployed = project
            print(f"\nProject: {name}")
            print(f"Deployment Status: {deployment_status}")
            print(f"Deployment URL: {deployment_url}")
            print(f"Last Deployed: {last_deployed}")

        # Query recent deployments
        cur.execute("""
            SELECT id, status, commit_message, error_message, created_at
            FROM deployments
            WHERE project_id = %s
            ORDER BY created_at DESC
            LIMIT 5
        """, (project_id,))

        deployments = cur.fetchall()

        if deployments:
            print(f"\n\nRecent Deployments:")
            print("-" * 100)
            print(f"{'Status':<15} {'Message':<30} {'Created':<20}")
            print("-" * 100)

            for deployment in deployments:
                dep_id, status, commit_msg, error_msg, created_at = deployment
                error_preview = error_msg[:50] + '...' if error_msg and len(error_msg) > 50 else (error_msg or '')
                print(f"{status:<15} {commit_msg:<30} {created_at}")
                if error_msg:
                    print(f"  Error: {error_preview}")

            print("-" * 100)
            print(f"Total: {len(deployments)} recent deployments")

        # Close connection
        cur.close()
        conn.close()

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python check_deployment_status.py <project_id>")
        sys.exit(1)

    project_id = sys.argv[1]
    check_deployment_status(project_id)
