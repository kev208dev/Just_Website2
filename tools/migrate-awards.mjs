// One-time migration of the legacy JustWebsite award data into src/content.
// Usage: node tools/migrate-awards.mjs <path-to-JustWebsite-checkout>
//
// The legacy data/awards.json lists the same 19 records twice (year "2024" and
// "2025"). The legacy site itself presented them as a single
// "2025 수상 아카이브 · 19 records" block, so duplicates are merged here and the
// record keeps year 2025. See README "Data review" for details.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const legacyRoot = process.argv[2];
if (!legacyRoot) throw new Error('pass the legacy repository path');

const raw = JSON.parse(readFileSync(join(legacyRoot, 'data/awards.json'), 'utf8').replace(/^﻿/, ''));

const tierOf = (label) => {
  if (/대상/.test(label)) return 1;
  if (/금상|최우수/.test(label)) return 2;
  if (/은상|우수|창의|총장|Best|개발상|3위/.test(label)) return 3;
  if (/장려|동상|특별|노력/.test(label)) return 4;
  return 5;
};
const gradeOf = (label) => label.replace(/^1위\s*\/\s*/, '').trim();

const seen = new Map();
for (const a of raw) {
  const key = [a.eventName, a.awardName, a.institution, a.members.join(',')].join('|');
  const prev = seen.get(key);
  if (!prev || Number(a.year) > Number(prev.year)) seen.set(key, a);
}

const records = [...seen.values()].map((a, i) => ({
  id: `a25-${String(i + 1).padStart(2, '0')}`,
  year: 2025,
  event: a.eventName,
  award: a.awardName,
  grade: gradeOf(a.awardName),
  tier: tierOf(a.awardName),
  institution: a.institution,
  generations: a.generation.split(',').map((g) => g.trim()).filter(Boolean),
  members: a.members,
  featured: tierOf(a.awardName) === 1,
}));

// "2024 프로젝트 아카이브" block of the legacy index.html (titles + grade only).
const html = readFileSync(join(legacyRoot, 'index.html'), 'utf8');
const block = html.split('id="archiveProjects2024Title"')[1].split('</section>')[0];
const cards = [...block.matchAll(/<strong\s*>([\s\S]*?)<\/strong\s*>[\s\S]*?<dd>([\s\S]*?)<\/dd>/g)];
const archive = cards.map((m, i) => {
  const title = m[1].replace(/\s+/g, ' ').trim();
  const grade = m[2].trim();
  return { id: `legacy-${String(i + 1).padStart(2, '0')}`, title, grade, tier: tierOf(grade) };
});

writeFileSync('src/content/awards.json', JSON.stringify(records, null, 2) + '\n');
writeFileSync('src/content/archive.json', JSON.stringify(archive, null, 2) + '\n');
console.log(`${raw.length} legacy rows -> ${records.length} unique records, ${archive.length} archive entries`);
