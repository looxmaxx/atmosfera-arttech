import io
import math
import os
import urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PHOTO_DIR = r"D:\antigy\atmosfera\demo\photos"
os.makedirs(PHOTO_DIR, exist_ok=True)

# Curated direct Unsplash image URLs (free to use under Unsplash License, attributed in docs)
UNSPLASH_URLS = {
    # d5_2: snowflakes on a red knitted mitten / winter snow closeup
    "d5_2": "https://images.unsplash.com/photo-1517299321609-52687d1bc55a?w=900&q=80",
    # d5_3: footprints in fresh snow at evening / winter street lamp
    "d5_3": "https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=900&q=80",
    # d6_1: sunrise over mountain peaks, sea of clouds
    "d6_1": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=80",
    # d6_2: tent and backpack on a mountain ridge at dawn
    "d6_2": "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=900&q=80",
    # d6_3: hiker looking at mountain valley in morning light
    "d6_3": "https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&q=80",
    # d7_1: birthday cake with lit candles in dark room
    "d7_1": "https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=900&q=80",
    # d7_2: colorful confetti / balloons at a party
    "d7_2": "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&q=80",
    # d7_3: hands raising glasses in a toast at a warm dinner table
    "d7_3": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=900&q=80",
}


def crop_3_4(im: Image.Image, target_w=720, target_h=960) -> Image.Image:
    im = im.convert("RGB")
    w, h = im.size
    target_ratio = target_w / target_h
    cur_ratio = w / h
    if cur_ratio > target_ratio:
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        im = im.crop((left, 0, left + new_w, h))
    else:
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        im = im.crop((0, top, w, top + new_h))
    return im.resize((target_w, target_h), Image.Resampling.LANCZOS)


def procedural_fallback(name: str, w=720, h=960) -> Image.Image:
    rng = np.random.default_rng(abs(hash(name)) % (2**32))
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    if name.startswith("d5"):
        top = np.array([28, 42, 68])
        bot = np.array([180, 195, 215])
        accent = (210, 65, 55) if name == "d5_2" else (245, 198, 105)
    elif name.startswith("d6"):
        top = np.array([45, 58, 95])
        bot = np.array([242, 148, 92])
        accent = (255, 210, 130)
    else:
        top = np.array([32, 18, 28])
        bot = np.array([140, 65, 40])
        accent = (255, 196, 85)
    arr = top[None, None, :] * (1 - y[:, :, None]) + bot[None, None, :] * y[:, :, None]
    noise = rng.normal(0, 10, (h, w, 3))
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    im = Image.fromarray(arr, "RGB")
    draw = ImageDraw.Draw(im, "RGBA")
    for _ in range(35):
        cx = int(rng.uniform(0, w))
        cy = int(rng.uniform(0, h))
        r = int(rng.uniform(12, 95))
        a = int(rng.uniform(40, 150))
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*accent, a))
    return im.filter(ImageFilter.GaussianBlur(2.0))


def main():
    for key, url in UNSPLASH_URLS.items():
        out_path = os.path.join(PHOTO_DIR, f"{key}.jpg")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            im = Image.open(io.BytesIO(data))
            im = crop_3_4(im)
            im.save(out_path, "JPEG", quality=84, optimize=True)
            print(f"Downloaded & saved {key}.jpg ({os.path.getsize(out_path)} bytes)")
        except Exception as e:
            print(f"Fallback for {key} due to {e}")
            im = procedural_fallback(key)
            im.save(out_path, "JPEG", quality=84, optimize=True)

    # Optimize all existing d1..d5_1 photos to 720x960 Q84 so repo size stays clean
    for fname in sorted(os.listdir(PHOTO_DIR)):
        if not fname.endswith(".jpg"):
            continue
        p = os.path.join(PHOTO_DIR, fname)
        im = Image.open(p)
        im = crop_3_4(im)
        im.save(p, "JPEG", quality=84, optimize=True)
        print(f"Normalized {fname}: {os.path.getsize(p)} bytes")


if __name__ == "__main__":
    main()
