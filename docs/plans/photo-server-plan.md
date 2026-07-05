# Photo Server Plan (v2) — Cloudflare-native

The source-of-truth plan for imgthing. See ADRs in `../decisions/` for the reasoning behind the
stack, and `../PROGRESS.md` for status. (UI stack was later revised — see ADR 0002.)

## Architecture

```
Browser (Nuxt SSR)
   │
   ▼
Cloudflare Worker (Nuxt via nitro cloudflare_module preset)
   │              │                    │
   ▼              ▼                    ▼
Cloudflare D1   Cloudflare R2      Cloudflare Images
(metadata)      (original photos)  (on-the-fly variants from R2)
```

## Data model

- **folders** — id, name, parent_folder_id, created_at, updated_at
- **photos** — id, original_filename, r2_key, content_type, file_size, folder_id, uploaded_at, updated_at
- **exif_data** — id, photo_id, camera_make, camera_model, lens_info, exposure, aperture, iso,
  focal_length, taken_at, gps_latitude, gps_longitude, other_data (JSON TEXT)

No `users` table — single owner, no per-row scoping.

## Milestones

1. **Foundation** — Nuxt on Workers, D1 + R2 + Images bindings, local dev with emulated bindings,
   domain pointed at a Custom Domain. _(app scaffold done; account provisioning + domain pending —
   see `../cloudflare-setup.md`)_
2. **Auth** — single-owner login, session handling; or Cloudflare Access in front of the Worker.
3. **Upload + Storage** — upload UI, originals to R2, D1 record, EXIF extracted at upload.
4. **Folder Management** — folder CRUD, nesting, move-between-folders.
5. **Gallery UI** — grid/list views, pagination, breadcrumbs.
6. **Photo Viewing** — lightbox/slider, EXIF panel, Images variant links.
7. **Search & Polish** — filename/date/EXIF search, tagging, mobile responsiveness.
8. **Deployment Hardening** — D1 Time Travel backups, R2 versioning, monitoring, export job, docs.

## Open items

- Auth: hand-rolled vs. Cloudflare Access (decide before/at Milestone 2).
- Variant preset sizes (thumbnail/medium/large) — config-level, not DB.
- Export-everything job (dump D1 + list R2 keys) as backup insurance beyond D1 Time Travel.

## Cost (ballpark, mid-2026 pricing)

~$5/mo at 1k images (mostly the Workers Paid base fee for CPU headroom); ~$8–9/mo at 10k images
+ 10k transforms. R2/D1/Images are effectively free at personal scale.
