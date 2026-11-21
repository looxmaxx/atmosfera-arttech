# -*- coding: utf-8 -*-
"""
Собирает готовую папку для загрузки на Google Диск по чек-листу формы Genesis Hackathon:
D:\\antigy\\Атмосфера_Genesis_ArtTech_2026\\
Включая настоящее MP4 демо-видео со звуком (60 сек, 1280x720, H.264 + AAC).
"""
import math
import os
import shutil
import subprocess
import wave
import zipfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

ROOT = r"D:\antigy\atmosfera"
DRIVE_DIR = r"D:\antigy\Атмосфера_Genesis_ArtTech_2026"
os.makedirs(DRIVE_DIR, exist_ok=True)


def load_font(names, size):
    for n in names:
        p = os.path.join(r"C:\Windows\Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


F_H1 = load_font(["georgia.ttf", "times.ttf"], 42)
F_H2 = load_font(["georgia.ttf", "times.ttf"], 28)
F_ITALIC = load_font(["georgiai.ttf", "timesi.ttf"], 23)
F_BODY = load_font(["segoeui.ttf", "arial.ttf"], 19)
F_BOLD = load_font(["segoeuib.ttf", "arialbd.ttf"], 19)
F_MONO = load_font(["consolab.ttf", "consola.ttf"], 14)


def make_combined_audio(out_wav, duration_sec=60):
    sr = 22050
    total_samples = sr * duration_sec
    out = np.zeros(total_samples, dtype=np.float32)

    tracks = [
        ("demo/audio/day1_autumn_waltz.wav", 0, 26),
        ("demo/audio/day2_night_deadline.wav", 25, 43),
        ("demo/audio/day3_summer_sea.wav", 42, 60),
    ]
    for rel, t0, t1 in tracks:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            continue
        with wave.open(p, "rb") as wf:
            raw = wf.readframes(wf.getnframes())
            arr = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        s0 = int(t0 * sr)
        s1 = min(total_samples, int(t1 * sr))
        seg_len = s1 - s0
        if seg_len <= 0:
            continue
        # Зациклим если нужно
        tiled = np.resize(arr, seg_len)
        fade = min(int(1.2 * sr), seg_len // 3)
        env = np.ones(seg_len, dtype=np.float32)
        env[:fade] = np.linspace(0, 1, fade)
        env[-fade:] = np.linspace(1, 0, fade)
        out[s0:s1] += tiled * env * 0.85

    out = np.clip(out, -0.98, 0.98)
    pcm = (out * 32767).astype(np.int16)
    with wave.open(out_wav, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


def draw_header(draw, W, step_tag, title):
    draw.rectangle((0, 0, W, 64), fill=(235, 229, 216))
    draw.line((0, 64, W, 64), fill=(29, 27, 24, 45), width=1)
    draw.ellipse((32, 22, 50, 40), fill=(196, 85, 45))
    draw.text((62, 18), "АТМОСФЕРА", fill=(29, 27, 24), font=F_H2)
    draw.text((250, 25), f"// {step_tag}", fill=(120, 110, 98), font=F_MONO)
    draw.text((W - 430, 25), title, fill=(196, 85, 45), font=F_MONO)


def build_demo_video(mp4_path):
    W, H = 1280, 720
    fps = 15
    duration = 60
    total_frames = fps * duration

    # Подготовим изображения
    p1_photos = [
        Image.open(os.path.join(ROOT, f"demo/photos/d1_{i}.jpg")).convert("RGB").resize((150, 200), Image.Resampling.LANCZOS)
        for i in (1, 2, 3)
    ]
    posters = []
    ex_root = os.path.join(ROOT, "examples")
    for folder in sorted(os.listdir(ex_root)):
        pp = os.path.join(ex_root, folder, "memory_poster.jpg")
        if os.path.exists(pp):
            posters.append((folder, Image.open(pp).convert("RGB")))

    poster_d1 = posters[0][1].resize((325, 578), Image.Resampling.LANCZOS)
    poster_d2 = posters[1][1].resize((325, 578), Image.Resampling.LANCZOS)
    small_posters = [(name, im.resize((156, 278), Image.Resampling.LANCZOS)) for name, im in posters]

    tmp_wav = os.path.join(ROOT, "tools", "_demo_audio.wav")
    make_combined_audio(tmp_wav, duration)

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg_exe,
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{W}x{H}",
        "-pix_fmt", "rgb24",
        "-r", str(fps),
        "-i", "-",
        "-i", tmp_wav,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        mp4_path,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    entry_text = (
        "«Гуляли по парку, всё в жёлтых листьях, было холодно,\n"
        "но мы пили горячее какао в бумажных стаканчиках\n"
        "и долго разговаривали у пруда. Перчатки пахли\n"
        "корицей, а утки плыли по золотой воде...»"
    )

    for f in range(total_frames):
        t = f / fps
        im = Image.new("RGB", (W, H), (243, 239, 230))
        draw = ImageDraw.Draw(im, "RGBA")

        if t < 13:
            # СЦЕНА 1: Сценарий пользователя (ввод текста, 3 фото и песни)
            draw_header(draw, W, "СЦЕНАРИЙ ПОЛЬЗОВАТЕЛЯ: ШАГ 1 — ВВОД ДНЯ", "GENESIS HACKATHON // ARTTECH")
            draw.text((48, 92), "Запись любимого дня: текст + фото + песня", fill=(29, 27, 24), font=F_H1)

            # Карточка текста с эффектом набора
            draw.rectangle((48, 156, 740, 390), fill=(255, 255, 255, 190), outline=(29, 27, 24, 50), width=1)
            draw.text((68, 172), "01 // ТЕКСТ ЗАПИСИ (СВОБОДНЫМ ТЕКСТОМ)", fill=(196, 85, 45), font=F_MONO)
            chars = int(min(1.0, t / 6.5) * len(entry_text))
            draw.multiline_text((68, 206), entry_text[:chars], fill=(29, 27, 24), font=F_ITALIC, spacing=8)

            # Фотографии
            draw.text((48, 412), "02 // ФОТОГРАФИИ ДНЯ (3 СНИМКА → K-MEANS ПАЛИТРА И СВЕТ)", fill=(196, 85, 45), font=F_MONO)
            for idx, ph in enumerate(p1_photos):
                if t > 2.0 + idx * 1.1:
                    im.paste(ph, (48 + idx * 170, 442))
                    draw.rectangle((48 + idx * 170, 442, 48 + idx * 170 + 150, 642), outline=(29, 27, 24, 80), width=1)

            # Песня и лог анализа справа
            draw.rectangle((775, 156, 1232, 642), fill=(255, 255, 255, 190), outline=(29, 27, 24, 50), width=1)
            draw.text((798, 174), "03 // ПЕСНЯ И МУЛЬТИМОДАЛЬНЫЙ АНАЛИЗ", fill=(196, 85, 45), font=F_MONO)
            draw.text((798, 208), "♪ Sinatra Tribute — Autumn Waltz in F", fill=(29, 27, 24), font=F_BOLD)
            draw.text((798, 238), "Web Audio API DSP: 84 BPM · F мажор · Вальс", fill=(90, 82, 72), font=F_BODY)

            steps = [
                (4.0, "● [ТЕКСТ] Теплота +0.72, Уют, Осень"),
                (5.8, "● [ПАПКА] «Осенний парк и горячее какао»"),
                (7.5, "● [ФОТО] Охра #C86428, Золото #D99B38"),
                (9.2, "● [МУЗЫКА] 84 BPM → плавный шаг 5.7 с"),
                (10.6, "● [ПРИЁМ] Импрессионизм · Клод Моне"),
                (11.6, "● [ГОЛОС] Спокойный и тёплый (0.91x)"),
            ]
            sy = 294
            for st_time, label in steps:
                if t >= st_time:
                    draw.text((798, sy), label, fill=(29, 27, 24), font=F_BODY)
                    sy += 46

        elif t < 26:
            # СЦЕНА 2: Готовое воспоминание 1 (Осенний парк и какао — Клод Моне)
            draw_header(draw, W, "ШАГ 2 — ГОТОВОЕ ВОСПОМИНАНИЕ И ПАПКА ДНЯ №01", "84 BPM · F МАЖОР · КЛОД МОНЕ")
            im.paste(poster_d1, (56, 96))
            # Пульсирующие живописные блики на постере
            for i in range(12):
                bx = 75 + int((i * 23 + t * 18) % 280)
                by = 135 + int((i * 41 + math.sin(t * 2 + i) * 20) % 340)
                draw.ellipse((bx - 12, by - 5, bx + 12, by + 5), fill=(217, 155, 56, 85))

            draw.text((425, 98), "📁 Папка: «Осенний парк и горячее какао»", fill=(29, 27, 24), font=F_H1)
            draw.text((425, 154), "ХУДОЖЕСТВЕННЫЙ ПРИЁМ: ИМПРЕССИОНИЗМ (КЛОД МОНЕ)", fill=(196, 85, 45), font=F_MONO)

            explanations = [
                ("ТЕКСТ", "Мотивы парка, жёлтых листьев и какао дали папке имя из 5 слов и тёплую рукописную цитату."),
                ("ФОТО", "Из 3 снимков извлечена золотисто-охристая палитра и рассеянный свет; контуры смягчены мазками Моне."),
                ("МУЗЫКА", "Джазовый вальс (84 BPM, F мажор) задал неторопливый ритм наплыва кадров и живую звуковую волну."),
                ("ОЗВУЧКА", "Подобран «Спокойный и тёплый» голос (скорость 0.91x, мягкие паузы 420 мс)."),
            ]
            ey = 196
            for tag, desc in explanations:
                draw.rectangle((425, ey, 1230, ey + 64), fill=(255, 255, 255, 175), outline=(29, 27, 24, 40))
                draw.text((442, ey + 10), f"[{tag}]", fill=(196, 85, 45), font=F_MONO)
                draw.text((535, ey + 18), desc, fill=(29, 27, 24), font=F_BODY)
                ey += 76

            # Содержимое папки дня
            draw.rectangle((425, 512, 1230, 674), fill=(235, 229, 216), outline=(29, 27, 24, 60))
            draw.text((445, 526), "СОДЕРЖИМОЕ СОХРАНЁННОЙ ПАПКИ ДНЯ (.ZIP / ДИСК):", fill=(29, 27, 24), font=F_MONO)
            draw.text((445, 556), "├─ note.txt   ├─ memory_poster.jpg (720×1280)   ├─ memory_video.webm (видео + музыка)", fill=(45, 40, 35), font=F_MONO)
            draw.text((445, 584), "├─ photos/ (photo_1.jpg, photo_2.jpg, photo_3.jpg)   ├─ music/ (track.wav + analysis.json)", fill=(45, 40, 35), font=F_MONO)
            draw.text((445, 612), "└─ voiceover/ (voice_preset.json)   └─ visual_passport.json (объяснимая логика)", fill=(45, 40, 35), font=F_MONO)

        elif t < 43:
            # СЦЕНА 3: Контрастный день (Ночь в офисе перед сдачей — Василий Кандинский)
            draw_header(draw, W, "ШАГ 3 — КОНТРАСТНЫЙ ДЕНЬ И ОБЪЯСНИМАЯ ЛОГИКА", "128 BPM · A МИНОР · В. КАНДИНСКИЙ")
            im.paste(poster_d2, (56, 96))
            # Пульсирующая геометрия Кандинского в бит 128 BPM
            beat = (t * (128 / 60)) % 1.0
            rad = int(18 + 14 * math.exp(-beat * 3.5))
            draw.ellipse((215 - rad, 285 - rad, 215 + rad, 285 + rad), outline=(224, 79, 62, 220), width=3)

            draw.text((425, 98), "📁 Папка: «Ночь в офисе перед сдачей»", fill=(29, 27, 24), font=F_H1)
            draw.text((425, 154), "ХУДОЖЕСТВЕННЫЙ ПРИЁМ: СУПРЕМАТИЗМ И СЕТКА (В. КАНДИНСКИЙ)", fill=(46, 74, 98), font=F_MONO)

            explanations2 = [
                ("ТЕКСТ", "Мотивы срочной сдачи, 3 часов ночи и офиса дали высокий индекс напряжения (0.85) и фокуса."),
                ("ФОТО", "Холодный свет монитора и ночного окна сформировал сине-серую графитовую палитру."),
                ("МУЗЫКА", "Электронный трек (128 BPM, A минор) включил резкий ритм смены кадров каждые 4 доли и пульс кругов."),
                ("СИСТЕМА", "Единое паспарту, штамп и шрифты сохраняют принадлежность тому же дневнику."),
            ]
            ey = 196
            for tag, desc in explanations2:
                draw.rectangle((425, ey, 1230, ey + 68), fill=(255, 255, 255, 185), outline=(29, 27, 24, 45))
                draw.text((442, ey + 12), f"[{tag}]", fill=(46, 74, 98), font=F_MONO)
                draw.text((545, ey + 20), desc, fill=(29, 27, 24), font=F_BODY)
                ey += 82

            # Сравнение двух полярных дней
            draw.rectangle((425, 535, 1230, 674), fill=(23, 30, 41), outline=(74, 143, 231))
            draw.text((448, 552), "ЕДИНЫЙ ВИЗУАЛЬНЫЙ ЯЗЫК — РАЗНОЕ ОЩУЩЕНИЕ:", fill=(74, 143, 231), font=F_MONO)
            draw.text((448, 582), "• Осенний парк (84 BPM, F мажор) → охра, мягкие мазки Моне, тёплый голос 0.91x", fill=(233, 238, 245), font=F_BODY)
            draw.text((448, 616), "• Ночь в офисе (128 BPM, A минор) → сине-серый графит, сетка Кандинского, чёткий голос 1.08x", fill=(233, 238, 245), font=F_BODY)

        else:
            # СЦЕНА 4: Архив и «Проверка лентой» (7 разных дней рядом)
            draw_header(draw, W, "ШАГ 4 — АРХИВ ДНЕВНИКА И «ПРОВЕРКА ЛЕНТОЙ» (7 ДНЕЙ РЯДОМ)", "ЕДИНАЯ СЕРИЯ · 6 ПРИЁМОВ")
            draw.text((42, 88), "Проверка лентой: 7 разных дней — один цельный дневник", fill=(29, 27, 24), font=F_H1)
            draw.text((42, 142), "У каждого дня своё настроение, палитра, ритм и папка, но все они узнаваемо являются страницами одной книги:", fill=(90, 82, 72), font=F_BODY)

            captions = [
                ("01 · Осенний парк", "Клод Моне · 84 BPM"),
                ("02 · Ночь в офисе", "Кандинский · 128 BPM"),
                ("03 · Солнечное море", "Матисс · 120 BPM"),
                ("04 · Дождь и чай", "Суми-э / Ма · 62 BPM"),
                ("05 · Первый снег", "Тарковский · 92 BPM"),
                ("06 · Рассвет в горах", "Фридрих · 100 BPM"),
                ("07 · Свечи на торте", "Матисс · 124 BPM"),
            ]
            for i, (_, pim) in enumerate(small_posters[:7]):
                x = 40 + i * 174
                y = 190
                im.paste(pim, (x, y))
                draw.rectangle((x, y, x + 156, y + 278), outline=(29, 27, 24, 90), width=1)
                draw.text((x, y + 288), captions[i][0], fill=(29, 27, 24), font=F_BOLD)
                draw.text((x, y + 314), captions[i][1], fill=(196, 85, 45), font=F_MONO)

            draw.rectangle((40, 555, 1240, 675), fill=(255, 255, 255, 200), outline=(29, 27, 24, 55))
            draw.text((64, 574), "ПРОТОТИП: https://looxmaxx.github.io/atmosfera-arttech/", fill=(29, 27, 24), font=F_H2)
            draw.text((64, 618), "GITHUB:   https://github.com/looxmaxx/atmosfera-arttech   //   Make the Invisible Visible_", fill=(196, 85, 45), font=F_MONO)

        proc.stdin.write(im.tobytes())

    proc.stdin.close()
    proc.wait()
    if os.path.exists(tmp_wav):
        os.remove(tmp_wav)
    print(f"Video created: {mp4_path} ({os.path.getsize(mp4_path)} bytes)")


def main():
    # 1. Ссылки на прототип и GitHub
    links_txt = (
        "GENESIS HACKATHON 2026 // ARTTECH // MAKE THE INVISIBLE VISIBLE\n"
        "ПРОЕКТ: АТМОСФЕРА — ЛИЧНЫЙ ДНЕВНИК ОЩУЩЕНИЙ\n"
        "=================================================================\n\n"
        "1. Рабочая веб-версия прототипа (GitHub Pages, открывается сразу в браузере):\n"
        "   https://looxmaxx.github.io/atmosfera-arttech/\n\n"
        "2. Репозиторий с исходным кодом, документацией и 7 примерами папок дней:\n"
        "   https://github.com/looxmaxx/atmosfera-arttech\n\n"
        "3. Локальный запуск из архива 07_Код_прототипа_atmosfera.zip (одной командой):\n"
        "   python -m http.server 8080\n"
        "   (затем открыть http://localhost:8080)\n"
    )
    with open(os.path.join(DRIVE_DIR, "01_ССЫЛКА_НА_ПРОТОТИП_И_GITHUB.txt"), "w", encoding="utf-8") as f:
        f.write(links_txt)

    # 2. Генерируем видео до 3 минут (60 секунд, HD MP4 со звуком)
    video_path = os.path.join(DRIVE_DIR, "02_Видео_демо_Атмосфера.mp4")
    build_demo_video(video_path)

    # 3. Копируем 7 примеров дней
    ex_dst = os.path.join(DRIVE_DIR, "03_Примеры_дней_7_папок")
    if os.path.exists(ex_dst):
        shutil.rmtree(ex_dst)
    shutil.copytree(os.path.join(ROOT, "examples"), ex_dst)

    # 4. Документы из раздела 09
    shutil.copyfile(
        os.path.join(ROOT, "docs", "DESCRIPTION_1PAGE.md"),
        os.path.join(DRIVE_DIR, "04_Описание_до_1_страницы.md"),
    )
    shutil.copyfile(
        os.path.join(ROOT, "docs", "ARTISTIC_TECHNIQUES.md"),
        os.path.join(DRIVE_DIR, "05_Художественные_приёмы_и_референсы.md"),
    )
    shutil.copyfile(
        os.path.join(ROOT, "docs", "TOOLS_AND_CREDITS.md"),
        os.path.join(DRIVE_DIR, "06_Использованные_инструменты_и_вклад.md"),
    )

    # 5. Полный ZIP-архив кода прототипа
    zip_path = os.path.join(DRIVE_DIR, "07_Код_прототипа_atmosfera.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            dirnames[:] = [d for d in dirnames if d not in (".git", "__pycache__")]
            for fn in filenames:
                if fn.startswith("_demo_audio"):
                    continue
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, ROOT)
                zf.write(full, os.path.join("atmosfera", rel))

    print("Drive package ready:", DRIVE_DIR)


if __name__ == "__main__":
    main()
