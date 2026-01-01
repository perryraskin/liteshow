#!/usr/bin/env python3
"""
Fix stale deployment records that are stuck at 'in_progress'
For projects with status 'live', update their in_progress deployments to 'success'
"""

import sys
import os
from datetime import datetime
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def fix_stale_deployments(project_id=None):
    """Update stale in_progress deployments to success"""

    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL not found in .env file")
        sys.exit(1)

    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()

        # Find projects with status 'live' that have in_progress deployments
        if project_id:
            query = """
                SELECT p.id, p.name, p.deployment_status, p.deployment_url, p.last_deployed_at
                FROM projects p
                WHERE p.id = %s AND p.deployment_status = 'live'
            """
            cur.execute(query, (project_id,))
        else:
            query = """
                SELECT p.id, p.name, p.deployment_status, p.deployment_url, p.last_deployed_at
                FROM projects p
                WHERE p.deployment_status = 'live'
            """
            cur.execute(query)

        projects = cur.fetchall()

        if not projects:
            print("No projects found with status 'live'")
            return

        print(f"\nFound {len(projects)} projects with status 'live'\n")

        for project in projects:
            proj_id, name, status, url, last_deployed = project
            print(f"Project: {name} (id: {proj_id})")
            print(f"  Status: {status}")
            print(f"  Last Deployed: {last_deployed}")

            # Find in_progress deployments for this project
            cur.execute("""
                SELECT id, status, created_at
                FROM deployments
                WHERE project_id = %s AND status = 'in_progress'
                ORDER BY created_at DESC
            """, (proj_id,))

            in_progress_deployments = cur.fetchall()

            if in_progress_deployments:
                print(f"  Found {len(in_progress_deployments)} in_progress deployments to fix")

                for dep_id, dep_status, created_at in in_progress_deployments:
                    # Update to success with completedAt set
                    cur.execute("""
                        UPDATE deployments
                        SET
                            status = 'success',
                            completed_at = COALESCE(%s, NOW()),
                            deployment_url = %s
                        WHERE id = %s
                        RETURNING id, status, completed_at
                    """, (last_deployed, url, dep_id))

                    updated = cur.fetchone()
                    print(f"    ✓ Updated deployment {dep_id}: {dep_status} -> success")

                # Commit changes for this project
                conn.commit()
                print(f"  ✓ Committed changes for {name}\n")
            else:
                print(f"  No in_progress deployments to fix\n")

        # Close connection
        cur.close()
        conn.close()

        print("✅ Done fixing stale deployments")

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    project_id = sys.argv[1] if len(sys.argv) > 1 else None

    if project_id:
        print(f"Fixing stale deployments for project: {project_id}")
    else:
        print("Fixing stale deployments for all projects with status 'live'")

    fix_stale_deployments(project_id)
