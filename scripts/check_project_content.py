#!/usr/bin/env python3
"""
Check pages in a Liteshow project by querying the project's Turso database
Usage: python check_project_content.py <project_id>
"""

import sys
import os
import psycopg2
import subprocess
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def get_project_turso_db(project_id):
    """Get the Turso database URL for a project"""

    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL not found in .env file")
        sys.exit(1)

    try:
        # Connect to main database
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()

        # Query project info
        cur.execute("""
            SELECT id, name, slug, turso_db_url, turso_db_token
            FROM projects
            WHERE id = %s
        """, (project_id,))

        project = cur.fetchone()

        # Close connection
        cur.close()
        conn.close()

        if not project:
            print(f"ERROR: Project not found: {project_id}")
            sys.exit(1)

        return project

    except Exception as e:
        print(f"ERROR querying main database: {e}")
        sys.exit(1)

def check_pages_in_turso(turso_url, turso_token):
    """Query pages from Turso database"""

    try:
        # Use turso CLI to query the database
        cmd = [
            'turso',
            'db',
            'shell',
            turso_url,
            '--token',
            turso_token,
            "SELECT id, title, slug, status, created_at FROM pages ORDER BY created_at DESC;"
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"ERROR querying Turso: {result.stderr}")
            sys.exit(1)

        return result.stdout

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python check_project_content.py <project_id>")
        sys.exit(1)

    project_id = sys.argv[1]

    # Get project info from main database
    project = get_project_turso_db(project_id)
    proj_id, name, slug, turso_url, turso_token = project

    print(f"\nProject: {name}")
    print(f"Slug: {slug}")
    print(f"Turso DB: {turso_url}")
    print("-" * 100)

    # Query pages from Turso database
    pages_output = check_pages_in_turso(turso_url, turso_token)
    print("\nPages in Turso database:")
    print(pages_output)
