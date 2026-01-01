# Liteshow Database Scripts

Python scripts for querying the Liteshow database.

## Setup

1. **Activate virtual environment:**
   ```bash
   source venv/bin/activate
   ```

2. **Environment variables are in `.env`** (not committed to git)

## Scripts

### check_pages_api.py

Check pages in a project via the API (easiest method).

```bash
python check_pages_api.py <project_id> <session_token>
```

To get your session token:
1. Log into the Liteshow dashboard
2. Open browser DevTools (F12)
3. Go to Application/Storage → Local Storage
4. Copy the value of `session_token`

Example:
```bash
python check_pages_api.py 432914df-bb95-48de-8cc6-5716fd2ff2b4 YOUR_TOKEN_HERE
```

### check_pages.py

Query the main PostgreSQL database (for projects table, etc).

```bash
python check_pages.py <project_id>
```

Note: Pages are stored in per-project Turso databases, not the main DB.

## Adding New Scripts

1. Create your `.py` file in this folder
2. Make it executable: `chmod +x your_script.py`
3. Use `dotenv` to load `.env` variables
4. Add any new dependencies to `requirements.txt` and run:
   ```bash
   pip install -r requirements.txt
   ```
