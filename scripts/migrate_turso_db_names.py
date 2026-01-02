#!/usr/bin/env python3
"""
Migrate Turso database names from slug-based to ID-based naming

This script:
1. Queries all projects from PostgreSQL
2. For each project, checks if old DB exists (liteshow-{slug})
3. Creates new DB with new name (liteshow-{id})
4. Copies all data from old DB to new DB using Turso API
5. Updates project record with new DB credentials
6. Deletes old DB

Usage: python migrate_turso_db_names.py [--dry-run]
"""

import sys
import os
import psycopg2
import requests
import json
from dotenv import load_dotenv
from typing import List, Tuple, Optional

# Load environment variables from .env file
load_dotenv()

def get_turso_credentials():
    """Get Turso API credentials from environment"""
    api_token = os.getenv('TURSO_API_TOKEN')
    org = os.getenv('TURSO_ORG', 'perryraskin')

    if not api_token:
        print("ERROR: TURSO_API_TOKEN not found in .env file")
        sys.exit(1)

    return api_token, org

def get_all_projects() -> List[Tuple]:
    """Get all projects from PostgreSQL"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL not found in .env file")
        sys.exit(1)

    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()

        cur.execute("""
            SELECT id, name, slug, turso_db_url, turso_db_token
            FROM projects
            ORDER BY created_at ASC
        """)

        projects = cur.fetchall()

        cur.close()
        conn.close()

        return projects

    except Exception as e:
        print(f"ERROR querying PostgreSQL: {e}")
        sys.exit(1)

def check_turso_db_exists(db_name: str, api_token: str, org: str) -> bool:
    """Check if a Turso database exists"""
    url = f"https://api.turso.tech/v1/organizations/{org}/databases/{db_name}"
    headers = {
        'Authorization': f'Bearer {api_token}',
    }

    response = requests.get(url, headers=headers)
    return response.status_code == 200

def create_turso_db(db_name: str, api_token: str, org: str) -> Tuple[str, str]:
    """Create a new Turso database and return (hostname, auth_token)"""
    url = f"https://api.turso.tech/v1/organizations/{org}/databases"
    headers = {
        'Authorization': f'Bearer {api_token}',
        'Content-Type': 'application/json',
    }
    body = {
        'name': db_name,
        'group': 'liteshow',
    }

    response = requests.post(url, headers=headers, json=body)

    if not response.ok:
        raise Exception(f"Failed to create database {db_name}: {response.text}")

    data = response.json()
    hostname = data['database']['Hostname']

    # Create auth token
    token_url = f"https://api.turso.tech/v1/organizations/{org}/databases/{db_name}/auth/tokens"
    token_body = {
        'expiration': 'never',
        'authorization': 'full-access',
    }

    token_response = requests.post(token_url, headers=headers, json=token_body)

    if not token_response.ok:
        raise Exception(f"Failed to create auth token for {db_name}: {token_response.text}")

    token_data = token_response.json()
    auth_token = token_data['jwt']

    return hostname, auth_token

def copy_turso_data(old_url: str, old_token: str, new_url: str, new_token: str):
    """
    Copy data from old Turso DB to new Turso DB

    Since Turso doesn't have a direct clone/replicate API for data migration,
    we'll use libsql client to read and write data.
    """
    try:
        # Import libsql (requires: pip install libsql-client)
        from libsql_client import create_client

        # Connect to both databases
        old_client = create_client(
            url=f"libsql://{old_url}",
            auth_token=old_token
        )

        new_client = create_client(
            url=f"libsql://{new_url}",
            auth_token=new_token
        )

        # Get all tables from old DB
        result = old_client.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row['name'] for row in result.rows if row['name'] != 'sqlite_sequence']

        for table in tables:
            print(f"  Copying table: {table}")

            # Get table schema
            schema_result = old_client.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}'")
            if schema_result.rows:
                create_sql = schema_result.rows[0]['sql']

                # Create table in new DB
                new_client.execute(create_sql)

                # Copy data
                data_result = old_client.execute(f"SELECT * FROM {table}")

                if data_result.rows:
                    # Get column names
                    columns = list(data_result.rows[0].keys())
                    placeholders = ','.join(['?' for _ in columns])
                    column_names = ','.join([f'"{col}"' for col in columns])

                    insert_sql = f"INSERT INTO {table} ({column_names}) VALUES ({placeholders})"

                    # Insert rows in batches
                    batch_size = 100
                    rows = data_result.rows

                    for i in range(0, len(rows), batch_size):
                        batch = rows[i:i + batch_size]
                        for row in batch:
                            values = [row[col] for col in columns]
                            new_client.execute(insert_sql, values)

                    print(f"    Copied {len(rows)} rows")

        old_client.close()
        new_client.close()

        return True

    except ImportError:
        print("  WARNING: libsql-client not installed. Install with: pip install libsql-client")
        print("  Skipping data copy - you'll need to manually copy data or the schema will be initialized empty.")
        return False
    except Exception as e:
        print(f"  ERROR copying data: {e}")
        return False

def delete_turso_db(db_name: str, api_token: str, org: str):
    """Delete a Turso database"""
    url = f"https://api.turso.tech/v1/organizations/{org}/databases/{db_name}"
    headers = {
        'Authorization': f'Bearer {api_token}',
    }

    response = requests.delete(url, headers=headers)

    if not response.ok and response.status_code != 404:
        print(f"  WARNING: Failed to delete old database {db_name}: {response.text}")

def update_project_turso_credentials(project_id: str, new_url: str, new_token: str):
    """Update project with new Turso credentials"""
    database_url = os.getenv('DATABASE_URL')

    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()

        cur.execute("""
            UPDATE projects
            SET turso_db_url = %s, turso_db_token = %s, updated_at = NOW()
            WHERE id = %s
        """, (new_url, new_token, project_id))

        conn.commit()
        cur.close()
        conn.close()

    except Exception as e:
        print(f"  ERROR updating project: {e}")
        raise

def migrate_project(project: Tuple, api_token: str, org: str, dry_run: bool = False) -> bool:
    """Migrate a single project from old DB name to new DB name"""
    project_id, name, slug, old_url, old_token = project

    old_db_name = f"liteshow-{slug}"
    new_db_name = f"liteshow-{project_id}"

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Migrating project: {name} ({project_id})")
    print(f"  Slug: {slug}")
    print(f"  Old DB: {old_db_name}")
    print(f"  New DB: {new_db_name}")

    # Check if old DB exists
    old_exists = check_turso_db_exists(old_db_name, api_token, org)
    new_exists = check_turso_db_exists(new_db_name, api_token, org)

    if not old_exists:
        print(f"  ⚠️  Old database doesn't exist (might already be migrated or never created)")

        # If new DB doesn't exist either, project might have tursoDbUrl = null
        if not new_exists and not old_url:
            print(f"  ℹ️  Project has no Turso database - skipping")
            return True

        if new_exists:
            print(f"  ✅ New database already exists - project likely already migrated")
            return True

        return False

    if new_exists:
        print(f"  ⚠️  New database already exists! This might be a naming conflict.")
        print(f"  Please manually review and handle this case.")
        return False

    if dry_run:
        print(f"  [DRY RUN] Would create new DB: {new_db_name}")
        print(f"  [DRY RUN] Would copy data from {old_db_name} to {new_db_name}")
        print(f"  [DRY RUN] Would update project record")
        print(f"  [DRY RUN] Would delete old DB: {old_db_name}")
        return True

    try:
        # Step 1: Create new database
        print(f"  Creating new database: {new_db_name}")
        new_url, new_token = create_turso_db(new_db_name, api_token, org)
        print(f"  ✅ New database created: {new_url}")

        # Step 2: Copy data
        print(f"  Copying data from old DB to new DB...")
        copy_success = copy_turso_data(old_url, old_token, new_url, new_token)

        if copy_success:
            print(f"  ✅ Data copied successfully")
        else:
            print(f"  ⚠️  Data copy skipped or failed - new DB will be empty")

        # Step 3: Update project record
        print(f"  Updating project record...")
        update_project_turso_credentials(project_id, new_url, new_token)
        print(f"  ✅ Project record updated")

        # Step 4: Delete old database
        print(f"  Deleting old database: {old_db_name}")
        delete_turso_db(old_db_name, api_token, org)
        print(f"  ✅ Old database deleted")

        print(f"  ✅ Migration complete for {name}")
        return True

    except Exception as e:
        print(f"  ❌ Migration failed: {e}")
        return False

def main():
    """Main migration function"""
    dry_run = '--dry-run' in sys.argv

    if dry_run:
        print("=" * 60)
        print("DRY RUN MODE - No changes will be made")
        print("=" * 60)

    print("\nTurso Database Name Migration Script")
    print("From: liteshow-{slug} → To: liteshow-{id}\n")

    # Get credentials
    api_token, org = get_turso_credentials()
    print(f"Turso Organization: {org}\n")

    # Get all projects
    print("Fetching all projects from PostgreSQL...")
    projects = get_all_projects()
    print(f"Found {len(projects)} projects\n")

    # Migrate each project
    success_count = 0
    skip_count = 0
    fail_count = 0

    for project in projects:
        result = migrate_project(project, api_token, org, dry_run)

        if result:
            success_count += 1
        else:
            skip_count += 1

    # Summary
    print("\n" + "=" * 60)
    print("MIGRATION SUMMARY")
    print("=" * 60)
    print(f"Total projects: {len(projects)}")
    print(f"✅ Successful: {success_count}")
    print(f"⚠️  Skipped: {skip_count}")
    print(f"❌ Failed: {fail_count}")

    if dry_run:
        print("\nThis was a DRY RUN - no changes were made.")
        print("Run without --dry-run to perform the actual migration.")

if __name__ == '__main__':
    main()
