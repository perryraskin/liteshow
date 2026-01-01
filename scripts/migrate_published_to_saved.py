#!/usr/bin/env python3
"""
Migration Script: Update "published" status to "saved"

This script updates all pages with status='published' to status='saved'
across all project Turso databases.

Usage: python migrate_published_to_saved.py
"""

import os
import sys
import psycopg2
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def migrate():
    """Update published status to saved across all project databases"""

    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in .env file")
        sys.exit(1)

    print("🔄 Starting migration: published → saved\n")

    try:
        # Connect to main PostgreSQL database
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()

        # Get all projects
        cur.execute("""
            SELECT id, name, turso_db_url, turso_db_token
            FROM projects
        """)

        projects = cur.fetchall()
        print(f"Found {len(projects)} projects\n")

        total_updated = 0

        # Update each project's Turso database
        for project in projects:
            project_id, name, turso_db_url, turso_db_token = project
            print(f"📦 Processing project: {name} ({project_id})")

            try:
                # Construct Turso HTTP API URL
                turso_url = f"https://{turso_db_url}"
                headers = {
                    "Authorization": f"Bearer {turso_db_token}",
                    "Content-Type": "application/json"
                }

                # Check for pages with status='published'
                check_payload = {
                    "statements": [
                        {"q": "SELECT COUNT(*) as count FROM pages WHERE status = 'published'"}
                    ]
                }

                response = requests.post(turso_url, headers=headers, json=check_payload)
                response.raise_for_status()
                result = response.json()

                count = 0
                if result and len(result) > 0 and "results" in result[0]:
                    rows = result[0]["results"]["rows"]
                    if rows and len(rows) > 0:
                        count = rows[0][0]

                if count > 0:
                    print(f"  ✏️  Found {count} published page(s), updating...")

                    # Update status from 'published' to 'saved'
                    update_payload = {
                        "statements": [
                            {"q": "UPDATE pages SET status = 'saved' WHERE status = 'published'"}
                        ]
                    }

                    update_response = requests.post(turso_url, headers=headers, json=update_payload)
                    update_response.raise_for_status()

                    print(f"  ✅ Updated {count} page(s)\n")
                    total_updated += count
                else:
                    print(f"  ℹ️  No published pages found\n")

            except Exception as project_error:
                print(f"  ❌ Error processing project {name}: {project_error}")
                print("")

        print(f"\n✅ Migration complete!")
        print(f"   Total pages updated: {total_updated}")

        # Close connection
        cur.close()
        conn.close()

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    migrate()
