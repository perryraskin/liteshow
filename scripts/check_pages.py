#!/usr/bin/env python3
"""
Check pages in a Liteshow project
Usage: python check_pages.py <project_id>
"""

import sys
import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def check_pages(project_id):
    """Query and display pages for a given project"""

    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL not found in .env file")
        sys.exit(1)

    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()

        # Query pages
        cur.execute("""
            SELECT id, title, slug, status, created_at, updated_at
            FROM pages
            WHERE project_id = %s
            ORDER BY created_at DESC
        """, (project_id,))

        pages = cur.fetchall()

        if not pages:
            print(f"No pages found for project: {project_id}")
        else:
            print(f"\nPages in project {project_id}:")
            print("-" * 100)
            print(f"{'Title':<30} {'Slug':<20} {'Status':<10} {'Created':<20}")
            print("-" * 100)

            for page in pages:
                page_id, title, slug, status, created_at, updated_at = page
                print(f"{title:<30} {slug:<20} {status:<10} {created_at}")

            print("-" * 100)
            print(f"Total: {len(pages)} pages")

        # Close connection
        cur.close()
        conn.close()

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python check_pages.py <project_id>")
        sys.exit(1)

    project_id = sys.argv[1]
    check_pages(project_id)
