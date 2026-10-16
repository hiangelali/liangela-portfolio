#!/usr/bin/env python3
import re
from pathlib import Path

site = Path(__file__).resolve().parent / "site"
video = site / "_cdn" / "videos" / "vimeo" / "427987373.mp4"
page = site / "dropbox-esignature" / "index.html"
if not video.exists():
    raise SystemExit(f"Missing {video}. Download from Vimeo and place it there first.")
text = page.read_text("utf-8")
if "local-mirror-video" in text and "427987373.mp4" in text:
    print("Already patched.")
    raise SystemExit(0)
m = re.search(
    r'<div\n      class="embed-block-wrapper"\n      style="padding-bottom:([^"]+);"\n    >\s*'
    r'<div\n        class="sqs-video-wrapper"[\s\S]*?</div>\s*</div>',
    text,
)
if not m:
    raise SystemExit("Could not find Vimeo embed block in dropbox-esignature page.")
pad = m.group(1)
rel = "../_cdn/videos/vimeo/427987373.mp4"
repl = f'''<div
      class="embed-block-wrapper"
      style="padding-bottom:{pad};position:relative;"
    >
      <video
        class="local-mirror-video"
        controls
        playsinline
        preload="metadata"
        style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;"
        src="{rel}"
      ></video>
    </div>'''
page.write_text(text[: m.start()] + repl + text[m.end() :], encoding="utf-8")
print("Patched dropbox-esignature to use local Vimeo MP4.")
