import csv
import hashlib
import json
import os
import re
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

SOURCE = Path(os.environ.get('PADHAI_PLAYSTORE_CSV', 'Google-Playstore.csv'))
OUT_DIR = Path(os.environ.get('PADHAI_CATALOG_OUT', 'catalog'))
ZIP_PATH = OUT_DIR / 'focus-app-catalog-v1.zip'
MANIFEST_PATH = OUT_DIR / 'focus-app-catalog-v1.manifest.json'

ALLOW_CATEGORIES = {
    'Education',
    'Educational',
    'Books & Reference',
}
BLOCK_CATEGORIES = {
    'Entertainment',
    'Music & Audio',
    'Video Players & Editors',
    'Comics',
    'Arcade',
    'Action',
    'Adventure',
    'Board',
    'Card',
    'Casino',
    'Casual',
    'Puzzle',
    'Racing',
    'Role Playing',
    'Simulation',
    'Sports',
    'Strategy',
    'Trivia',
    'Word',
}
PACKAGE_RE = re.compile(r'^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$')

if not SOURCE.exists():
    raise SystemExit(f'source dataset not found: {SOURCE}')

OUT_DIR.mkdir(parents=True, exist_ok=True)
allow: dict[str, set[str]] = {category: set() for category in sorted(ALLOW_CATEGORIES)}
block: dict[str, set[str]] = {category: set() for category in sorted(BLOCK_CATEGORIES)}
category_counts = Counter()
invalid_rows = 0
row_count = 0

with SOURCE.open('r', encoding='utf-8', newline='') as handle:
    reader = csv.DictReader(handle)
    required = {'App Id', 'Category'}
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise SystemExit(f'missing columns: {sorted(missing)}')
    for row in reader:
        row_count += 1
        category = (row.get('Category') or '').strip()
        package_name = (row.get('App Id') or '').strip().lower()
        category_counts[category] += 1
        if category not in ALLOW_CATEGORIES and category not in BLOCK_CATEGORIES:
            continue
        if not PACKAGE_RE.fullmatch(package_name):
            invalid_rows += 1
            continue
        if category in allow:
            allow[category].add(package_name)
        if category in block:
            block[category].add(package_name)

# Package-level deny wins over dataset allow if a dirty/duplicate snapshot has both labels.
all_blocked = set().union(*block.values()) if block else set()
for category in allow:
    allow[category].difference_update(all_blocked)

entries: dict[str, list[str]] = {}
for category, packages in allow.items():
    entries[f'allow_{category.lower().replace(" ", "_").replace("&", "and")}'] = sorted(packages)
for category, packages in block.items():
    entries[f'block_{category.lower().replace(" ", "_").replace("&", "and")}'] = sorted(packages)

manifest = {
    'schemaVersion': 1,
    'catalogRevision': 'playstore-2021-06-v1',
    'generatedAt': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
    'source': 'https://www.kaggle.com/datasets/gauthamp10/google-playstore-apps',
    'sourceSnapshot': 'Collected June 2021; Kaggle dataset version 7',
    'license': 'Open Database License (ODbL 1.0) as listed by Kaggle',
    'packageFormat': 'lowercase Android package IDs, one per line, sorted',
    'allowCategories': sorted(ALLOW_CATEGORIES),
    'blockCategories': sorted(BLOCK_CATEGORIES),
    'rowsRead': row_count,
    'invalidRelevantRows': invalid_rows,
    'counts': {name: len(values) for name, values in entries.items()},
    'sourceCategoryCounts': {name: category_counts[name] for name in sorted(ALLOW_CATEGORIES | BLOCK_CATEGORIES)},
}

# Zip text files and manifest. Native code extracts these once to filesDir and does exact on-disk binary search.
with zipfile.ZipFile(ZIP_PATH, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, values in entries.items():
        archive.writestr(f'{name}.txt', ('\n'.join(values) + '\n').encode('utf-8'))
    archive.writestr('manifest.json', json.dumps(manifest, indent=2, sort_keys=True).encode('utf-8'))

manifest['archiveSha256'] = hashlib.sha256(ZIP_PATH.read_bytes()).hexdigest()
manifest['archiveBytes'] = ZIP_PATH.stat().st_size
MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n', encoding='utf-8')

print(json.dumps(manifest, indent=2, sort_keys=True))
