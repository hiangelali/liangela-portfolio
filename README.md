# Angela Li portfolio — local mirror

Offline copy of [https://www.liangela.com/](https://www.liangela.com/), including password-protected case studies.

## Preview

A local server is the simplest way to browse (keeps paths working):

```bash
cd site
python3 -m http.server 8765
```

Open [http://localhost:8765/](http://localhost:8765/)

## What’s included

- Home / Work, About, Archive, and all public case studies
- Password-protected pages (unlocked during mirroring with your page password):
  - `/locked-marketplace-internationalization`
  - `/locked-new-facebook`
- Images, CSS, JS, Squarespace fonts, and Orpheus Pro (Typekit) fonts
- Squarespace animation scripts/styles

Assets live under `site/_cdn/`.

## Videos

Included locally:
- **Clearer Fees** — Squarespace-hosted MP4
- **New Facebook** — local MP4 (`site/_cdn/videos/youtube/2dELyFhct9Q.mp4`)
- **Dropbox eSignature** — local 1440p MP4 (`site/_cdn/videos/vimeo/427987373.mp4`)

## Re-mirror

```bash
python3 mirror_site.py
```

Then re-open the local server from `site/`.
