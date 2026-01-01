#!/usr/bin/env python3
"""
Check pages in a Liteshow project via the API
Usage: python check_pages_api.py <project_id> <session_token>

The session_token can be found in your browser's localStorage after logging into the dashboard.
"""

import sys
import requests

def check_pages(project_id, session_token, api_url="https://devpi-3008.shmob.xyz"):
    """Query pages via the Liteshow API"""

    headers = {
        'Authorization': f'Bearer {session_token}'
    }

    try:
        # Get project info
        project_response = requests.get(
            f"{api_url}/projects/{project_id}",
            headers=headers
        )

        if project_response.status_code != 200:
            print(f"ERROR: Failed to get project: {project_response.status_code}")
            print(project_response.text)
            sys.exit(1)

        project = project_response.json()
        print(f"\nProject: {project['name']}")
        print(f"Slug: {project['slug']}")
        print(f"GitHub: {project.get('githubRepoUrl', 'Not connected')}")
        print(f"Live URL: {project.get('liveUrl', 'Not deployed')}")
        print("-" * 100)

        # Get pages
        pages_response = requests.get(
            f"{api_url}/projects/{project_id}/pages",
            headers=headers
        )

        if pages_response.status_code != 200:
            print(f"ERROR: Failed to get pages: {pages_response.status_code}")
            print(pages_response.text)
            sys.exit(1)

        pages = pages_response.json()

        if not pages:
            print("No pages found")
        else:
            print(f"\n{'Title':<30} {'Slug':<20} {'Status':<10}")
            print("-" * 100)

            for page in pages:
                title = page.get('title', 'Untitled')
                slug = page.get('slug', '')
                status = page.get('status', 'unknown')
                print(f"{title:<30} {slug:<20} {status:<10}")

            print("-" * 100)
            print(f"Total: {len(pages)} pages")
            print(f"\nPublished pages: {sum(1 for p in pages if p.get('status') == 'published')}")

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python check_pages_api.py <project_id> <session_token> [api_url]")
        print("\nYou can find your session_token in the browser's localStorage after logging in.")
        sys.exit(1)

    project_id = sys.argv[1]
    session_token = sys.argv[2]
    api_url = sys.argv[3] if len(sys.argv) > 3 else "https://devpi-3008.shmob.xyz"

    check_pages(project_id, session_token, api_url)
