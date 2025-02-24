from os import getenv

import turbopuffer as tp

REPO_NAME = getenv("REPO_NAME")
TURBOPUFFER_API_KEY = getenv("TURBOPUFFER_API_KEY")

if not REPO_NAME:
    raise ValueError("REPO_NAME is not set")

if not TURBOPUFFER_API_KEY:
    raise ValueError("TURBOPUFFER_API_KEY is not set")

tp.api_key = getenv("TURBOPUFFER_API_KEY")
tp.api_base_url = "https://gcp-us-east4.turbopuffer.com"

ns = tp.Namespace(f'site-{REPO_NAME}')

if not ns.exists():
    print(f"Namespace {REPO_NAME} does not exist")
    exit(0)

ns.delete_all()
