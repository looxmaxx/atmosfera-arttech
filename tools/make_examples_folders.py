# -*- coding: utf-8 -*-
"""
Генерирует в папке examples/ 7 готовых примеров папок дней с постерами (720x1280)
и файлами note.txt / visual_passport.json для быстрой проверки жюри прямо в GitHub.
"""
import json
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = r"D:\antigy\atmosfera"
OUT_DIR = os.path.join(ROOT, "examples")
os.makedirs(OUT_DIR, exist_ok=True)

DAYS = [
    {
        "seq": 1,
        "folder": "01 — Осенний парк и горячее какао",
        "title": "Осенний парк и горячее какао",
        "date": "18 ОКТ 2026",
        "place": "СТАРЫЙ БОТАНИЧЕСКИЙ ПАРК · +6°C",
        "tech": "ИМПРЕССИОНИЗМ · КЛОД МОНЕ",
        "bpm": 84,
        "mode": "F МАЖОР",
        "song": "Sinatra Tribute Trio — Autumn Waltz in F",
        "voice": "Спокойный и тёплый (0.91x)",
        "quote": "Гуляли по парку, всё в жёлтых листьях, было холодно, но мы пили горячее какао...",
        "text": "Гуляли по парку, всё в жёлтых листьях, было холодно, но мы пили горячее какао в бумажных стаканчиках и долго разговаривали у пруда. Перчатки пахли дымом и корицей, утки плыли по золотой воде, и совсем не хотелось спешить домой.",
        "photo": "demo/photos/d1_1.jpg",
        "bg": (242, 230, 208),
        "bg2": (228, 207, 168),
        "ink": (43, 33, 24),
        "accent": (200, 100, 40),
        "accent2": (217, 155, 56),
        "style": "monet",
    },
    {
        "seq": 2,
        "folder": "02 — Ночь в офисе перед сдачей",
        "title": "Ночь в офисе перед сдачей",
        "date": "19 НОЯ 2026",
        "place": "ОФИС, 14 ЭТАЖ · +1°C",
        "tech": "ГЕОМЕТРИЧЕСКИЙ РИТМ · В. КАНДИНСКИЙ",
        "bpm": 128,
        "mode": "A МИНОР",
        "song": "Kandinsky Pulse — Night Compile 128",
        "voice": "Собранный и чёткий (1.08x)",
        "quote": "Срочная сдача проекта, три часа ночи в пустом офисе, в наушниках электронная музыка.",
        "text": "Срочная сдача проекта, три часа ночи в пустом офисе. На столе остывший эспрессо, в наушниках плотная электронная музыка, за панорамным стеклом холодные огни проспекта. Пальцы стучат по клавиатуре, сборка наконец проходит без ошибок!",
        "photo": "demo/photos/d2_1.jpg",
        "bg": (23, 30, 41),
        "bg2": (36, 48, 64),
        "ink": (233, 238, 245),
        "accent": (74, 143, 231),
        "accent2": (224, 79, 62),
        "style": "kandinsky",
    },
    {
        "seq": 3,
        "folder": "03 — Солнечное море и арбуз с друзьями",
        "title": "Солнечное море и арбуз с друзьями",
        "date": "24 ИЮЛ 2026",
        "place": "ДИКИЙ ПЛЯЖ У МЫСА · +29°C",
        "tech": "СОЛНЕЧНЫЙ ДЕКУПАЖ · АНРИ МАТИСС",
        "bpm": 120,
        "mode": "D МАЖОР",
        "song": "Sun Cutouts — Turquoise Coastline",
        "voice": "Живой и солнечный (1.06x)",
        "quote": "Прыгали в бирюзовые волны до головокружения и ели ледяной арбуз с друзьями!",
        "text": "Прыгали в бирюзовые волны до головокружения, смеялись с друзьями на весь берег и ели ледяной сладкий арбуз прямо на полосатом полотенце. Соль на плечах, солнце слепит глаза, самое беззаботное лето!",
        "photo": "demo/photos/d3_1.jpg",
        "bg": (247, 239, 224),
        "bg2": (242, 223, 190),
        "ink": (25, 35, 45),
        "accent": (227, 74, 46),
        "accent2": (22, 133, 141),
        "style": "matisse",
    },
    {
        "seq": 4,
        "folder": "04 — Дождь за окном и тихий чай",
        "title": "Дождь за окном и тихий чай",
        "date": "29 ОКТ 2026",
        "place": "ДОМА У ПОДОКОННИКА · +7°C",
        "tech": "ТУШЬ СУМИ-Э И ПРОСТРАНСТВО «МА»",
        "bpm": 62,
        "mode": "E МИНОР",
        "song": "Ma Ensemble — Raindrops on Glass",
        "voice": "Тихий и задумчивый (0.86x)",
        "quote": "Весь день за окном шёл мелкий серый дождь, капли медленно сползали по стеклу...",
        "text": "Весь день за окном шёл мелкий серый дождь, капли медленно сползали по стеклу. Сидел один на подоконнике с чашкой зелёного чая и бумажной книгой, смотрел на редкие зонты внизу и слушал тихое пианино...",
        "photo": "demo/photos/d4_1.jpg",
        "bg": (230, 232, 228),
        "bg2": (211, 216, 210),
        "ink": (34, 40, 38),
        "accent": (85, 107, 99),
        "accent2": (125, 140, 133),
        "style": "sumie",
    },
    {
        "seq": 5,
        "folder": "05 — Первый снег в старом дворе",
        "title": "Первый снег в старом дворе",
        "date": "15 НОЯ 2026",
        "place": "СТАРЫЙ ДВОР С ФОНАРЁМ · -3°C",
        "tech": "АНАЛОГОВАЯ ПЛЁНКА · А. ТАРКОВСКИЙ",
        "bpm": 92,
        "mode": "C МАЖОР",
        "song": "Polaroid Tape — Courtyard Streetlamp 1986",
        "voice": "Спокойный и тёплый (0.91x)",
        "quote": "В жёлтом луче старого фонаря кружатся крупные снежинки, совсем как в детстве.",
        "text": "Вышел вечером во двор — а там тихо падает первый снег. В жёлтом луче старого фонаря кружатся крупные снежинки, на красной вязаной варежке не тают кристаллы, и свежие следы ведут к тёплому подъезду, совсем как в детстве.",
        "photo": "demo/photos/d5_1.jpg",
        "bg": (29, 36, 50),
        "bg2": (43, 53, 72),
        "ink": (242, 234, 219),
        "accent": (224, 159, 69),
        "accent2": (124, 153, 184),
        "style": "tarkovsky",
    },
    {
        "seq": 6,
        "folder": "06 — Рассвет в горах выше облаков",
        "title": "Рассвет в горах выше облаков",
        "date": "19 АВГ 2026",
        "place": "ПЕРЕВАЛ, 3100 М · +4°C",
        "tech": "РОМАНТИЧЕСКИЙ ГОРИЗОНТ · К. Д. ФРИДРИХ",
        "bpm": 100,
        "mode": "G МАЖОР",
        "song": "Horizon Light — Above the Sea of Clouds",
        "voice": "Воздушный и вдохновенный (0.95x)",
        "quote": "Под ногами целое море белых облаков, а вершины вспыхнули розовым и золотым светом.",
        "text": "Вышли из палатки ещё в темноте и поднялись на хребет к самому рассвету. Под ногами целое море белых облаков, а вершины вспыхнули розовым и золотым светом. Стоишь на ветру, дышишь полной грудью — и внутри абсолютная свобода.",
        "photo": "demo/photos/d6_1.jpg",
        "bg": (35, 42, 58),
        "bg2": (68, 56, 70),
        "ink": (245, 237, 226),
        "accent": (232, 133, 84),
        "accent2": (242, 190, 114),
        "style": "friedrich",
    },
    {
        "seq": 7,
        "folder": "07 — Свечи на торте и шум друзей",
        "title": "Свечи на торте и шум друзей",
        "date": "08 НОЯ 2026",
        "place": "ГОСТИНАЯ, ПОЛНЫЙ ДОМ ГОСТЕЙ",
        "tech": "СОЛНЕЧНЫЙ ДЕКУПАЖ · АНРИ МАТИСС",
        "bpm": 124,
        "mode": "B♭ МАЖОР",
        "song": "Midnight Brass — Candles & Confetti 124",
        "voice": "Живой и солнечный (1.06x)",
        "quote": "В комнате погасили свет и внесли торт со свечами! Конфетти и звон бокалов!",
        "text": "В комнате погасили свет и внесли торт со свечами! Конфетти в воздухе, звон бокалов, все друзья кричат поздравления, обнимаются и танцуют прямо между стульями. Шумный, тёплый и безумно счастливый день рождения!",
        "photo": "demo/photos/d7_1.jpg",
        "bg": (245, 233, 214),
        "bg2": (236, 214, 182),
        "ink": (34, 24, 22),
        "accent": (222, 78, 44),
        "accent2": (234, 168, 54),
        "style": "matisse",
    },
]


def load_font(names, size):
    for n in names:
        p = os.path.join(r"C:\Windows\Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


FONT_MONO = load_font(["consolab.ttf", "consola.ttf", "lucon.ttf"], 13)
FONT_MONO_SM = load_font(["consola.ttf", "lucon.ttf"], 11)
FONT_SERIF = load_font(["georgia.ttf", "times.ttf"], 34)
FONT_QUOTE = load_font(["georgiai.ttf", "timesi.ttf", "segoepr.ttf"], 20)


def render_poster(d):
    W, H = 720, 1280
    y = np.linspace(0, 1, H)[:, None]
    top = np.array(d["bg"], dtype=np.float32)
    bot = np.array(d["bg2"], dtype=np.float32)
    arr = (top[None, None, :] * (1 - y[:, :, None]) + bot[None, None, :] * y[:, :, None])
    rng = np.random.default_rng(d["seq"] * 97)
    arr = np.clip(arr + rng.normal(0, 4.5, (H, W, 3)), 0, 255).astype(np.uint8)
    im = Image.fromarray(arr, "RGB")
    draw = ImageDraw.Draw(im, "RGBA")

    ink = d["ink"]
    acc = d["accent"]
    acc2 = d["accent2"]
    pad = 26

    # Рамка серии
    draw.rectangle((pad, pad, W - pad, H - pad), outline=(*ink, 65), width=1)
    draw.text((pad + 20, pad + 18), f"АТМОСФЕРА // ПАПКА ДНЯ №0{d['seq']}", fill=(*ink, 195), font=FONT_MONO)
    draw.text((pad + 20, pad + 38), f"{d['date']} · {d['place']}", fill=(*ink, 145), font=FONT_MONO_SM)
    draw.ellipse((W - pad - 66, pad + 16, W - pad - 22, pad + 60), outline=(*acc, 230), width=2)
    draw.text((W - pad - 56, pad + 31), f"{d['bpm']}", fill=(*ink, 220), font=FONT_MONO)
    draw.line((pad + 16, pad + 70, W - pad - 16, pad + 70), fill=(*ink, 45), width=1)

    # Центральное фотоокно
    air = 64 if d["style"] == "sumie" else 42 if d["style"] == "kandinsky" else 48
    wx, wy = air, 114
    ww, wh = W - air * 2, 740
    ph_path = os.path.join(ROOT, d["photo"])
    if os.path.exists(ph_path):
        ph = Image.open(ph_path).convert("RGB").resize((ww, wh), Image.Resampling.LANCZOS)
        # Тонировка
        overlay = Image.new("RGB", (ww, wh), acc)
        ph = Image.blend(ph, overlay, 0.16)
        im.paste(ph, (wx, wy))

    # Художественный слой по стилю
    if d["style"] == "monet":
        for _ in range(75):
            cx = int(rng.uniform(wx, wx + ww))
            cy = int(rng.uniform(wy, wy + wh))
            if wx + 70 < cx < wx + ww - 70 and wy + 70 < cy < wy + wh - 70:
                continue
            rx = int(rng.uniform(16, 36))
            ry = int(rng.uniform(6, 12))
            col = acc if rng.random() < 0.5 else acc2
            draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(*col, 95))
    elif d["style"] == "kandinsky":
        for c in range(1, 6):
            gx = wx + (ww * c) // 6
            draw.line((gx, wy, gx, wy + wh), fill=(*ink, 48), width=1)
        for r in range(1, 8):
            gy = wy + (wh * r) // 8
            draw.line((wx, gy, wx + ww, gy), fill=(*ink, 48), width=1)
        for i in range(6):
            cx = int(rng.uniform(wx + 50, wx + ww - 50))
            cy = int(rng.uniform(wy + 50, wy + wh - 50))
            rad = int(rng.uniform(22, 56))
            col = acc if i % 2 == 0 else acc2
            draw.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=(*col, 110), outline=(*ink, 210), width=2)
        draw.line((wx + 30, wy + wh - 40, wx + ww - 30, wy + 50), fill=(*acc2, 210), width=3)
    elif d["style"] == "sumie":
        for _ in range(40):
            rx = int(rng.uniform(wx + 10, wx + ww - 10))
            ry = int(rng.uniform(wy + 10, wy + wh - 45))
            draw.line((rx, ry, rx - 2, ry + 30), fill=(*ink, 70), width=1)
    elif d["style"] == "tarkovsky":
        for _ in range(55):
            sx = int(rng.uniform(wx + 8, wx + ww - 8))
            sy = int(rng.uniform(wy + 8, wy + wh - 8))
            draw.ellipse((sx - 2, sy - 2, sx + 2, sy + 2), fill=(255, 247, 232, 165))
        draw.text((wx + 12, wy + wh - 22), "KODACHROME 64 // 24A", fill=(*acc, 210), font=FONT_MONO_SM)
    elif d["style"] == "matisse":
        for i in range(8):
            cx = wx + 22 if i % 2 == 0 else wx + ww - 22
            cy = wy + 60 + i * 85
            col = acc if i % 2 == 0 else acc2
            draw.ellipse((cx - 28, cy - 16, cx + 28, cy + 16), fill=(*col, 155))

    draw.rectangle((wx, wy, wx + ww, wy + wh), outline=(*ink, 95), width=2 if d["style"] == "kandinsky" else 1)

    # Нижний паспорт ощущения
    fy = wy + wh + 26
    left = pad + 22
    draw.text((left, fy), f"{d['tech']} · {d['bpm']} BPM · {d['mode']}", fill=(*acc, 245), font=FONT_MONO)
    draw.text((left, fy + 26), f"«{d['title']}»", fill=(*ink, 255), font=FONT_SERIF)
    draw.text((left, fy + 78), d["quote"][:64] + ("…" if len(d["quote"]) > 64 else ""), fill=(*ink, 210), font=FONT_QUOTE)

    my = H - pad - 74
    draw.line((left, my - 14, W - left, my - 14), fill=(*ink, 45), width=1)
    draw.text((left, my - 2), f"♪ {d['song'].upper()[:44]}", fill=(*ink, 235), font=FONT_MONO)

    # Палитра 5 плашек
    swatches = [d["bg"], acc, acc2, d["bg2"], ink]
    for i, col in enumerate(swatches):
        sx = left + i * 33
        sy = my + 24
        draw.rectangle((sx, sy, sx + 28, sy + 10), fill=(*col, 255), outline=(*ink, 70))

    draw.text((W - left - 235, my + 22), f"ГОЛОС: {d['voice'].upper()}", fill=(*ink, 155), font=FONT_MONO_SM)
    return im


def main():
    strips = []
    for d in DAYS:
        fdir = os.path.join(OUT_DIR, d["folder"])
        os.makedirs(fdir, exist_ok=True)
        poster = render_poster(d)
        poster_path = os.path.join(fdir, "memory_poster.jpg")
        poster.save(poster_path, "JPEG", quality=88, optimize=True)
        strips.append(poster.resize((240, 426), Image.Resampling.LANCZOS))

        with open(os.path.join(fdir, "note.txt"), "w", encoding="utf-8") as f:
            f.write(
                f"ПАПКА ДНЯ: «{d['title']}»\n"
                f"Дата: {d['date']} | Место: {d['place']}\n"
                f"Художественный приём: {d['tech']}\n"
                f"Песня: {d['song']} ({d['bpm']} BPM, {d['mode']})\n"
                f"Озвучка: {d['voice']}\n\n"
                f"{d['text']}\n"
            )

    # Склеим единую ленту из 7 дней («Проверка лентой») для README
    gap = 14
    pad = 20
    sw = len(strips) * 240 + (len(strips) - 1) * gap + pad * 2
    sh = 426 + pad * 2
    strip_im = Image.new("RGB", (sw, sh), (243, 239, 230))
    for i, s in enumerate(strips):
        strip_im.paste(s, (pad + i * (240 + gap), pad))
    strip_im.save(os.path.join(OUT_DIR, "feed_strip_7_days.jpg"), "JPEG", quality=88, optimize=True)
    print("Generated 7 example folders and feed_strip_7_days.jpg")


if __name__ == "__main__":
    main()
