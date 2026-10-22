"""Rebuild src/data/awards.json from the original JustWebsite sources.

- 2025 records: data/awards.json of the old repo. The file contains every record
  twice (once mislabelled "2024", once "2025"); the old index.html publishes them as
  the 19-record "2025 수상 아카이브", so only the 2025 copies are kept.
- Earlier archive: the 39 entries of the "2024 프로젝트 아카이브" block in the old
  index.html. They carry only a title and grade, and their titles span 2021-2025,
  so no year is assigned.
- 2026: the two projects listed under "2026 수상 아카이브" (no award detail published).
Usage: python3 -I tools/migrate-awards.py <old-repo-dir> <out.json>
"""
import json, re, sys, html

old, out = sys.argv[1], sys.argv[2]
raw = json.load(open(f"{old}/data/awards.json", encoding="utf-8-sig"))

def tier(name):
    n = name.replace(" ", "")
    if "대상" in n: return "grand"
    if any(k in n for k in ["최우수", "금상"]): return "gold"
    if any(k in n for k in ["우수", "은상"]): return "silver"
    if any(k in n for k in ["장려", "동상", "3위", "노력"]): return "bronze"
    if any(k in n for k in ["선정", "본선"]): return "selection"
    return "special"

seen, records = set(), []
for r in raw:
    if r["year"] != "2025":
        continue
    key = (r["eventName"], r["awardName"], r["institution"])
    if key in seen: continue
    seen.add(key)
    records.append({
        "year": 2025,
        "event": r["eventName"],
        "award": r["awardName"],
        "tier": tier(r["awardName"]),
        "institution": r["institution"],
        "generations": [g.strip() for g in r["generation"].split(",") if g.strip()],
        "members": r["members"],
        "project": None,
        "source": "2025 수상 아카이브",
    })

index = open(f"{old}/index.html", encoding="utf-8").read()
block = index.split('id="archiveProjects2024Title"')[1].split("</section>")[0]
for strong, dd in re.findall(r"<strong\s*>(.*?)</strong\s*>\s*<dl>.*?<dd>(.*?)</dd>", block, re.S):
    title = html.unescape(re.sub(r"\s+", " ", strong).strip())
    award = html.unescape(dd.strip())
    records.append({
        "year": None,
        "event": title,
        "award": award,
        "tier": tier(award),
        "institution": None,
        "generations": [],
        "members": [],
        "project": None,
        "source": "이전 수상 아카이브",
    })

for title, slug in [("청각장애인의 수어번역 프로그램 다이노수어", "dino-sueo"), ("유휴공간 연결 플랫폼 CrocTick", "croctick")]:
    records.append({
        "year": 2026, "event": title, "award": None, "tier": None, "institution": None,
        "generations": [], "members": [], "project": slug, "source": "2026 수상 아카이브",
    })

for i, r in enumerate(records, 1):
    r["id"] = f"a{i:03d}"
records = [{"id": r.pop("id"), **r} for r in records]
json.dump(records, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
from collections import Counter
print(len(records), Counter(r["source"] for r in records), Counter(r["tier"] for r in records))
