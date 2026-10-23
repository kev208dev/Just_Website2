# Awards image verification and migration status

19 user-supplied photographs inspected; 16 linked to existing 2025 awards, 3 retained offline pending verification. 2025 awards remain 19 records; legacy archive remains 39; total prize value is unchanged.

## Published image-to-record mapping (2025)

| Photo | Award ID | Status |
|---|---|---|
| award-01.webp | a25-16 | Existing award, photo linked |
| award-02.webp | a25-14 | Existing award, photo linked |
| award-03.webp | a25-04 | Existing award, photo linked |
| award-04.webp | a25-07 | Existing award, photo linked |
| award-05.webp | a25-17 | Existing award, photo linked |
| award-07.webp | a25-12 | Existing award, photo linked |
| award-08.webp | a25-19 | Existing award, photo linked |
| award-09.webp | a25-18 | Existing award, photo linked |
| award-10.webp | a25-01 | Existing award, photo linked |
| award-11.webp | a25-05 | Existing award, photo linked |
| award-12.webp | a25-03 | Existing award, photo linked |
| award-15.webp | a25-13 | Existing award, photo linked |
| award-16.webp | a25-02 | Existing award, photo linked |
| award-17.webp | a25-11 | Existing award, photo linked |
| award-18.webp | a25-15 | Existing award, photo linked |
| award-19.webp | a25-09 | Existing award, photo linked |

## Held back — not on public website
- Photo 06: promotional title suggests a Daegu award, but pictured certificate belongs to a different event. Do not link to a25-06.
- Photo 13: printed promotional title says statistics competition silver, but pictured backdrop concerns an invention award. Do not link to a25-10.
- Photo 14: issuer and grade not independently legible. Do not link to a25-08 or a25-04.

## Image caveats
- Photo 09: overlaid promotional issuer conflicts with pictured bronze award board. Existing a25-18 record remains unchanged; label drawn outside image is sourced from structured data.
- Photo 10: overlaid promotional issuer conflicts with pictured grand prize board. Existing a25-01 record remains unchanged.
- Photo 19: portrait, lower resolution than other photos; always preserve aspect and avoid full-bleed enlargement.
- Some supplied pictures show identifiable students and social handles. Publication permission must be confirmed by the site operator.
- Do not create new awards or modify financial/tier statistics based solely on photographic graphics.

## Implementation
- `public/images/awards/`: 16 WebP images (01–05, 07–12, 15–19).
- Awards: four grand-prize feature cards; separate photographic wall for 12 remaining records; record expander shows each photo.
- Home Archive: three grand-prize photos, now directly tied to three matching featured awards.
