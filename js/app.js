// ============================================================================
// АТМОСФЕРА // Главный контроллер веб-приложения (Архив, Студия записи, Папка дня)
// ============================================================================

import { analyzeText, analyzePhotos, analyzeAudioSource, normalizeFolderTitle } from "./analyze.js";
import { TECHNIQUES, SYSTEM_INVARIANTS, buildVisualPassport } from "./visual-system.js";
import { drawDayFrame, renderPosterDataUrl, createLiveStagePlayer, formatDateRu } from "./renderer.js";
import { speakDayEntry, stopVoiceover, isVoiceSpeaking, createMicRecorder } from "./voice.js";
import { downloadDayFolderZip, saveDayFolderToDisk } from "./zip.js";
import { getAllDays, getDayById, saveDay, deleteDay, clearAllDays } from "./storage.js";
import { DEMO_SEEDS, buildDayObjectFromSeed } from "./demo-days.js";

const viewEl = document.getElementById("view");
const toastEl = document.getElementById("toast");

let activeStagePlayer = null;
let daysCache = [];
let archiveFilter = "all";
let archiveSearch = "";
let archiveStripMode = false;

export function showToast(msg, duration = 3200) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.hidden = true;
  }, duration);
}

function cleanupActiveStage() {
  stopVoiceover();
  if (activeStagePlayer) {
    activeStagePlayer.destroy();
    activeStagePlayer = null;
  }
}

// Инициализация демо-архива при первом открытии
async function ensureInitialSeed() {
  daysCache = await getAllDays();
  if (daysCache.length > 0) return;

  viewEl.innerHTML = `
    <div class="empty">
      <div class="eyebrow">Первичная сборка дневника</div>
      <h2>Проявляем 7 демонстрационных дней...</h2>
      <p class="muted" id="seed-status">Анализируем фотографии, музыку и строим визуальные паспорта...</p>
    </div>
  `;
  const statusEl = document.getElementById("seed-status");
  for (let i = 0; i < DEMO_SEEDS.length; i++) {
    const seed = DEMO_SEEDS[i];
    if (statusEl) statusEl.textContent = `День ${i + 1} из ${DEMO_SEEDS.length}: «${seed.location}»...`;
    const day = await buildDayObjectFromSeed(seed);
    await saveDay(day);
  }
  daysCache = await getAllDays();
}

// Маршрутизатор
async function route() {
  cleanupActiveStage();
  const hash = window.location.hash || "#/";
  const navLinks = document.querySelectorAll(".nav a[data-nav]");
  navLinks.forEach(a => a.classList.remove("active"));

  if (hash.startsWith("#/new")) {
    document.querySelector('.nav a[data-nav="new"]')?.classList.add("active");
    renderNewEntryView();
  } else if (hash.startsWith("#/day/")) {
    const id = decodeURIComponent(hash.slice("#/day/".length));
    await renderDayDetailView(id);
  } else if (hash.startsWith("#/system")) {
    document.querySelector('.nav a[data-nav="system"]')?.classList.add("active");
    await renderSystemView();
  } else if (hash.startsWith("#/settings")) {
    document.querySelector('.nav a[data-nav="settings"]')?.classList.add("active");
    renderSettingsView();
  } else {
    document.querySelector('.nav a[data-nav="archive"]')?.classList.add("active");
    await renderArchiveView();
  }
}

// ============================================================================
// 1. АРХИВ ДНЕЙ (ЛЕНТА И «ПРОВЕРКА ЛЕНТОЙ»)
// ============================================================================
async function renderArchiveView() {
  daysCache = await getAllDays();

  const filtered = daysCache.filter(d => {
    if (archiveFilter !== "all" && d.passport?.techniqueId !== archiveFilter) return false;
    if (archiveSearch.trim()) {
      const q = archiveSearch.trim().toLowerCase();
      const hay = `${d.folderTitle} ${d.text} ${d.location || ""} ${d.musicAnalysis?.title || ""} ${d.musicAnalysis?.artist || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  viewEl.innerHTML = `
    <section class="archive-head">
      <div>
        <div class="eyebrow">GENESIS HACKATHON // ARTTECH // ЛИЧНЫЙ ДНЕВНИК ОЩУЩЕНИЙ</div>
        <h1>Архив прожитых дней</h1>
        <p class="lead">Каждый день хранится в собственной папке с коротким названием, где текст, фотографии и песня сливаются в живое воспоминание по правилам единой визуальной системы.</p>
      </div>
      <div class="row">
        <a class="btn primary" href="#/new">+ Записать новый день</a>
        <a class="btn ghost" href="#/system">Правила визуальной системы</a>
      </div>
    </section>

    <section class="archive-tools" style="margin-bottom: 22px;">
      <input id="arch-search" class="search" type="search" placeholder="Поиск по папкам, тексту, песням..." value="${escapeHtml(archiveSearch)}" />
      <div class="seg" role="tablist">
        <button data-tech="all" class="${archiveFilter === "all" ? "on" : ""}">Все (${daysCache.length})</button>
        <button data-tech="monet" class="${archiveFilter === "monet" ? "on" : ""}">Моне · Уют</button>
        <button data-tech="kandinsky" class="${archiveFilter === "kandinsky" ? "on" : ""}">Кандинский · Фокус</button>
        <button data-tech="matisse" class="${archiveFilter === "matisse" ? "on" : ""}">Матисс · Радость</button>
        <button data-tech="sumie" class="${archiveFilter === "sumie" ? "on" : ""}">Суми-э · Тишина</button>
        <button data-tech="tarkovsky" class="${archiveFilter === "tarkovsky" ? "on" : ""}">Плёнка · Память</button>
        <button data-tech="friedrich" class="${archiveFilter === "friedrich" ? "on" : ""}">Фридрих · Простор</button>
      </div>
      <span class="spacer"></span>
      <button id="toggle-strip" class="btn small ${archiveStripMode ? "accent" : "ghost"}">
        ${archiveStripMode ? "✓ Режим «Проверка лентой» (все рядом)" : "Проверка лентой (7 дней рядом)"}
      </button>
    </section>

    ${
      filtered.length === 0
        ? `<div class="empty">
            <h2>Дней по этому фильтру пока нет</h2>
            <p class="muted">Попробуйте сбросить фильтр или создайте новую запись дня.</p>
            <div class="row">
              <button id="reset-filter" class="btn">Показать все дни</button>
              <a href="#/new" class="btn primary">+ Записать день</a>
            </div>
          </div>`
        : `<div class="${archiveStripMode ? "strip" : "feed big"}">
            ${filtered
              .map(
                d => `
              <a class="day-card" href="#/day/${encodeURIComponent(d.id)}">
                <div class="poster">
                  <img src="${d.posterDataUrl || ""}" alt="${escapeHtml(d.folderTitle)}" loading="lazy" />
                </div>
                <div class="meta">
                  <div class="date">📁 ${formatDateRu(d.date)} · ${d.musicAnalysis?.bpm || 90} BPM</div>
                  <div class="title">«${escapeHtml(d.folderTitle)}»</div>
                  <div class="tech">${escapeHtml(d.passport?.technique?.name || "")} · ♪ ${escapeHtml(d.musicAnalysis?.title || "")}</div>
                </div>
              </a>
            `
              )
              .join("")}
          </div>`
    }
  `;

  document.getElementById("arch-search")?.addEventListener("input", e => {
    archiveSearch = e.target.value;
    renderArchiveView();
  });
  document.querySelectorAll("[data-tech]").forEach(btn => {
    btn.addEventListener("click", () => {
      archiveFilter = btn.getAttribute("data-tech");
      renderArchiveView();
    });
  });
  document.getElementById("toggle-strip")?.addEventListener("click", () => {
    archiveStripMode = !archiveStripMode;
    renderArchiveView();
  });
  document.getElementById("reset-filter")?.addEventListener("click", () => {
    archiveFilter = "all";
    archiveSearch = "";
    renderArchiveView();
  });
}

// ============================================================================
// 2. ЗАПИСЬ НОВОГО ДНЯ (СТУДИЯ ВОСПОМИНАНИЯ)
// ============================================================================
function renderNewEntryView() {
  let stagedPhotos = [];
  let musicTab = "preset"; // preset | file | link
  let stagedAudioFile = null;
  let selectedPresetIdx = 0;

  const todayIso = new Date().toISOString().slice(0, 10);

  viewEl.innerHTML = `
    <div class="eyebrow">НОВАЯ ЗАПИСЬ // СЦЕНАРИЙ ПОЛЬЗОВАТЕЛЯ</div>
    <h1>Сохранить ощущение дня</h1>
    <p class="lead">Расскажите о дне так, как рассказали бы близкому другу, приложите фотографии и песню. Система проанализирует текст, свет снимков и ритм музыки — и соберёт живую страницу дневника.</p>

    <div class="row" style="margin-top: 16px;">
      <span class="mono muted" style="font-size: 12px;">БЫСТРЫЙ ПРИМЕР ДЛЯ ПРОВЕРКИ:</span>
      <button type="button" class="btn small ghost" data-fill="0">🍂 Осенний парк и какао (Моне)</button>
      <button type="button" class="btn small ghost" data-fill="1">⚡ Ночь в офисе перед сдачей (Кандинский)</button>
      <button type="button" class="btn small ghost" data-fill="4">❄️ Первый снег в старом дворе (Плёнка)</button>
      <button type="button" class="btn small ghost" data-fill="2">🌊 Море и арбуз с друзьями (Матисс)</button>
    </div>

    <div class="new-grid">
      <form id="new-day-form" class="card">
        <div class="field">
          <label for="f-text">01 // Запись дня (свободным текстом)</label>
          <textarea id="f-text" class="textarea" required placeholder="Погода, свет, запахи, звуки, люди рядом, мелкие детали, которые запомнились..."></textarea>
          <div class="hint">Пишите конкретно: слова и ритм фраз определят эмоциональные оси, рукописную цитату и название папки дня (3–7 слов).</div>
        </div>

        <div class="field">
          <label>02 // Фотографии дня (минимум 1 фото)</label>
          <div id="photo-drop" class="drop">
            <div><strong>Перетащите фотографии сюда</strong> или нажмите, чтобы выбрать файлы (.jpg, .png, .webp)</div>
            <div class="hint" style="margin-top:4px;">Компьютерное зрение извлечёт из снимков 5 доминирующих цветов, баланс света и цветовую температуру</div>
            <input id="f-photos" type="file" accept="image/*" multiple hidden />
          </div>
          <div id="photo-thumbs" class="thumbs"></div>
        </div>

        <div class="field">
          <label>03 // Песня, которая звучала в этот день</label>
          <div class="tabs" id="music-tabs">
            <button type="button" data-mtab="preset" class="on">Фонотека CC0 (аудиоанализ)</button>
            <button type="button" data-mtab="file">Свой аудиофайл (.mp3 / .wav)</button>
            <button type="button" data-mtab="link">Ссылка (Spotify / Яндекс / YouTube)</button>
          </div>

          <div id="mtab-preset" style="margin-top: 12px;">
            <select id="f-preset-track" class="select">
              ${DEMO_SEEDS.map(
                (s, idx) =>
                  `<option value="${idx}">♪ ${escapeHtml(s.music.artist)} — ${escapeHtml(s.music.title)} (${s.music.bpm} BPM, ${s.music.keySignature}, ${s.music.genre})</option>`
              ).join("")}
            </select>
            <div class="hint" style="margin-top:6px;">Оригинальные инструментальные дорожки со свободной лицензией CC0 — декодируются через Web Audio API.</div>
          </div>

          <div id="mtab-file" class="hidden" style="margin-top: 12px;">
            <input id="f-audio-file" class="input" type="file" accept="audio/*" />
            <div class="hint" style="margin-top:6px;">Web Audio API вычислит темп (BPM), лад (мажор/минор по хроматограмме), энергию (RMS) и яркость тембра.</div>
          </div>

          <div id="mtab-link" class="hidden" style="margin-top: 12px;">
            <input id="f-music-url" class="input" type="url" placeholder="https://open.spotify.com/track/... или music.yandex.ru / youtube.com" />
            <div class="grid2" style="margin-top: 10px;">
              <input id="f-music-artist" class="input" type="text" placeholder="Исполнитель (напр. Frank Sinatra)" />
              <input id="f-music-title" class="input" type="text" placeholder="Название песни" />
            </div>
            <div class="grid3" style="margin-top: 10px;">
              <input id="f-music-genre" class="input" type="text" placeholder="Жанр (jazz, techno, indie...)" />
              <input id="f-music-bpm" class="input" type="number" min="50" max="180" placeholder="Темп BPM (напр. 84)" />
              <select id="f-music-mode" class="select">
                <option value="auto">Лад: определить авто</option>
                <option value="major">Мажор (светлый)</option>
                <option value="minor">Минор (погружённый)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="field">
          <label>04 // Дополнительно (по желанию и с вашего согласия)</label>
          <div class="grid3">
            <input id="f-date" class="input" type="date" value="${todayIso}" />
            <input id="f-location" class="input" type="text" placeholder="Место (напр. Осенний парк)" />
            <input id="f-weather" class="input" type="text" placeholder="Погода (напр. +6°C, ветер)" />
          </div>
          <div class="row" style="margin-top: 8px;">
            <button type="button" id="btn-geo" class="btn small ghost">📍 Определить геолокацию и погоду</button>
            <input id="f-custom-title" class="input" style="flex:1;" type="text" placeholder="Своё название папки (оставьте пустым для автогенерации 3–7 слов)" />
          </div>
        </div>

        <div id="gen-progress" class="progress hidden"></div>

        <div class="row" style="margin-top: 20px;">
          <button type="submit" id="btn-submit" class="btn primary">✨ Превратить день в воспоминание</button>
          <a href="#/" class="btn ghost">Отмена</a>
        </div>
      </form>

      <aside class="side-note">
        <div class="card">
          <div class="eyebrow">КАК РАБОТАЕТ СИСТЕМА</div>
          <h3 style="margin-top:6px;">От невидимого к видимому</h3>
          <ol>
            <li><strong>Текст → Смысл и папка:</strong> выделяем эмоциональные оси (валентность, теплоту, напряжение, ностальгию), ключевую цитату и даём папке имя из 3–7 слов в едином тоне.</li>
            <li><strong>Фото → Палитра и свет:</strong> кластеризация пикселей находит 5 доминирующих оттенков, контраст и характер освещения.</li>
            <li><strong>Песня → Ритм и воздух:</strong> темп (BPM) задаёт шаг смены кадров и скорость движения, а лад (мажор/минор) и энергия управляют полями «воздуха» и насыщенностью.</li>
            <li><strong>Художественный приём:</strong> система включает один из 6 режимов (Моне, Кандинский, Матисс, Суми-э, Плёнка Тарковского, Фридрих) и подбирает тембр голоса озвучки.</li>
          </ol>
        </div>
        <div class="card">
          <div class="eyebrow">ПРАВИЛА И АВТОРСКОЕ ПРАВО</div>
          <p class="muted" style="margin:8px 0 0; font-size:13.5px;">Все вычисления выполняются локально в вашем браузере. При добавлении ссылки на стриминг песня не копируется, а открывается через официальный плеер и процедурный ритм-синтезатор.</p>
        </div>
      </aside>
    </div>
  `;

  const thumbsEl = document.getElementById("photo-thumbs");
  const fileInput = document.getElementById("f-photos");
  const dropEl = document.getElementById("photo-drop");

  function renderThumbs() {
    thumbsEl.innerHTML = stagedPhotos
      .map(
        (src, i) => `
        <div class="th">
          <img src="${src}" alt="Фото ${i + 1}" />
          <button type="button" data-rm="${i}" title="Удалить">×</button>
        </div>`
      )
      .join("");
    thumbsEl.querySelectorAll("[data-rm]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-rm"));
        stagedPhotos.splice(idx, 1);
        renderThumbs();
      });
    });
  }

  async function handleFiles(fileList) {
    for (const file of Array.from(fileList || [])) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await readFileAsDataUrl(file);
      stagedPhotos.push(dataUrl);
    }
    renderThumbs();
  }

  dropEl.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", e => handleFiles(e.target.files));
  dropEl.addEventListener("dragover", e => {
    e.preventDefault();
    dropEl.classList.add("over");
  });
  dropEl.addEventListener("dragleave", () => dropEl.classList.remove("over"));
  dropEl.addEventListener("drop", e => {
    e.preventDefault();
    dropEl.classList.remove("over");
    handleFiles(e.dataTransfer.files);
  });

  // Переключение вкладок музыки
  document.querySelectorAll("#music-tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      musicTab = btn.getAttribute("data-mtab");
      document.querySelectorAll("#music-tabs button").forEach(b => b.classList.toggle("on", b === btn));
      document.getElementById("mtab-preset").classList.toggle("hidden", musicTab !== "preset");
      document.getElementById("mtab-file").classList.toggle("hidden", musicTab !== "file");
      document.getElementById("mtab-link").classList.toggle("hidden", musicTab !== "link");
    });
  });

  document.getElementById("f-audio-file")?.addEventListener("change", e => {
    stagedAudioFile = e.target.files?.[0] || null;
  });

  // Быстрое заполнение демо-сценарием для проверки
  document.querySelectorAll("[data-fill]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-fill"));
      const seed = DEMO_SEEDS[idx] || DEMO_SEEDS[0];
      document.getElementById("f-text").value = seed.text;
      document.getElementById("f-date").value = seed.date;
      document.getElementById("f-location").value = seed.location;
      document.getElementById("f-weather").value = seed.weather;
      document.getElementById("f-preset-track").value = String(idx);
      selectedPresetIdx = idx;
      stagedPhotos = [...seed.photos];
      renderThumbs();
      showToast(`Загружен пример: «${seed.location}»`);
    });
  });

  // Геолокация по согласию пользователя
  document.getElementById("btn-geo")?.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      showToast("Геолокация недоступна в этом браузере");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude.toFixed(2);
        const lon = pos.coords.longitude.toFixed(2);
        const locInput = document.getElementById("f-location");
        if (locInput && !locInput.value) locInput.value = `Координаты ${lat}°N, ${lon}°E`;
        showToast("Координаты добавлены");
      },
      () => showToast("Доступ к геолокации отклонён")
    );
  });

  // Отправка формы и пошаговая сборка воспоминания
  document.getElementById("new-day-form").addEventListener("submit", async e => {
    e.preventDefault();
    const text = document.getElementById("f-text").value.trim();
    if (!text) {
      showToast("Напишите хотя бы пару фраз о том, как прошёл день");
      return;
    }
    if (stagedPhotos.length === 0) {
      // Если пользователь не загрузил фото, предложим фото из выбранного пресета
      const fallbackSeed = DEMO_SEEDS[Number(document.getElementById("f-preset-track").value) || 0];
      stagedPhotos = [...fallbackSeed.photos];
      renderThumbs();
    }

    const submitBtn = document.getElementById("btn-submit");
    submitBtn.disabled = true;
    const prog = document.getElementById("gen-progress");
    prog.classList.remove("hidden");

    const setStep = (stepTitle, detail) => {
      prog.innerHTML += `<div class="step done"><b>${escapeHtml(stepTitle)}</b><span>${escapeHtml(detail)}</span></div>`;
    };

    const date = document.getElementById("f-date").value || todayIso;
    const location = document.getElementById("f-location").value.trim();
    const weather = document.getElementById("f-weather").value.trim();
    const customTitle = document.getElementById("f-custom-title").value.trim();

    // Шаг 1: Текст
    const textAnalysis = analyzeText(text, { date, location, weather, customTitle });
    setStep("01 // ТЕКСТ", `Папка: «${textAnalysis.folderTitle}» · теги: ${textAnalysis.tags.join(", ")}`);
    await sleep(180);

    // Шаг 2: Фото
    const photoAnalysis = await analyzePhotos(stagedPhotos);
    setStep("02 // ФОТО", `Извлечена палитра ${photoAnalysis.palette.slice(0, 3).join(" ")} · ${photoAnalysis.lightCharacter}`);
    await sleep(180);

    // Шаг 3: Музыка
    let musicInput = {};
    if (musicTab === "file" && stagedAudioFile) {
      const audioDataUrl = await readFileAsDataUrl(stagedAudioFile);
      musicInput = {
        audioBlob: stagedAudioFile,
        audioUrl: audioDataUrl,
        title: stagedAudioFile.name.replace(/\.[^.]+$/, ""),
        artist: "Аудиофайл пользователя"
      };
    } else if (musicTab === "link") {
      const modeVal = document.getElementById("f-music-mode").value;
      musicInput = {
        url: document.getElementById("f-music-url").value.trim(),
        artist: document.getElementById("f-music-artist").value.trim() || "Исполнитель",
        title: document.getElementById("f-music-title").value.trim() || "Песня дня",
        genre: document.getElementById("f-music-genre").value.trim(),
        bpm: Number(document.getElementById("f-music-bpm").value) || undefined,
        mode: modeVal === "auto" ? undefined : modeVal
      };
    } else {
      const idx = Number(document.getElementById("f-preset-track").value) || 0;
      const seedMusic = DEMO_SEEDS[idx].music;
      musicInput = {
        audioUrl: seedMusic.url,
        ...seedMusic
      };
    }

    const musicAnalysis = await analyzeAudioSource(musicInput);
    if (musicInput.audioUrl && musicInput.audioUrl.startsWith("data:audio")) {
      musicAnalysis.audioDataUrl = musicInput.audioUrl;
    }
    setStep("03 // МУЗЫКА", `${musicAnalysis.bpm} BPM · ${musicAnalysis.keySignature} · энергия ${Math.round(musicAnalysis.energy * 100)}%`);
    await sleep(180);

    // Шаг 4: Визуальный паспорт и рендер постера
    const passport = buildVisualPassport({ textAnalysis, photoAnalysis, musicAnalysis });
    setStep("04 // ПРИЁМ", `${passport.technique.name} · голос: «${passport.voicePreset.name}»`);

    const allDays = await getAllDays();
    const newDay = {
      id: `day-${Date.now()}`,
      seq: allDays.length + 1,
      date,
      location: textAnalysis.place,
      weather,
      text,
      folderTitle: textAnalysis.folderTitle,
      photos: stagedPhotos,
      textAnalysis,
      photoAnalysis,
      musicAnalysis,
      passport
    };
    newDay.posterDataUrl = await renderPosterDataUrl(newDay);
    await saveDay(newDay);
    showToast(`Создана папка дня: «${newDay.folderTitle}»`);
    window.location.hash = `#/day/${encodeURIComponent(newDay.id)}`;
  });
}

// ============================================================================
// 3. ПРОСМОТР ДНЯ И ЕГО ПАПКИ (ЖИВАЯ СЦЕНА + ОБЪЯСНИМАЯ ЛОГИКА + ОЗВУЧКА)
// ============================================================================
async function renderDayDetailView(id) {
  const day = await getDayById(id);
  if (!day) {
    viewEl.innerHTML = `<div class="empty"><h2>Папка дня не найдена</h2><div class="row"><a class="btn" href="#/">Вернуться в архив</a></div></div>`;
    return;
  }

  const vp = day.passport;
  const pal = vp.palette;
  const m = day.musicAnalysis || {};
  let recordedVideoBlob = null;
  let micRecorder = null;

  viewEl.innerHTML = `
    <div class="row" style="margin-bottom: 18px;">
      <a href="#/" class="btn small ghost">← Весь архив</a>
      <span class="mono muted" style="font-size: 12px;">📁 архив / ${escapeHtml(day.date || "")} — ${escapeHtml(day.folderTitle)} /</span>
      <span class="spacer"></span>
      <button id="btn-del-day" class="btn small ghost" title="Удалить запись">Удалить</button>
    </div>

    <div class="day-layout">
      <div class="stage-wrap">
        <div id="stage-box" class="stage" title="Нажмите, чтобы запустить или остановить живое воспоминание">
          <canvas id="day-canvas" width="720" height="1280"></canvas>
          <div class="play-overlay"><span>▶</span></div>
        </div>
        <div id="stage-timeline" class="timeline"><i id="stage-bar"></i></div>
        <div class="stage-controls">
          <button id="btn-play" class="btn primary small">▶ Оживить сцену + музыку</button>
          <button id="btn-voice" class="btn small">🔊 Озвучить голосом дня</button>
          <button id="btn-rec-video" class="btn small ghost">🎬 Скачать видео (.webm)</button>
        </div>
      </div>

      <div class="day-info">
        <div class="eyebrow">ПАПКА ДНЯ №${String(day.seq || 1).padStart(2, "0")} · ${formatDateRu(day.date)} · ${escapeHtml(day.location || "")} ${day.weather ? `· ${escapeHtml(day.weather)}` : ""}</div>
        <h1 id="day-title-heading">«${escapeHtml(day.folderTitle)}»</h1>

        <div class="chips" style="margin-top: 10px;">
          <span class="chip dark">${escapeHtml(vp.technique.name)}</span>
          <span class="chip">♪ ${escapeHtml(m.artist || "")} — ${escapeHtml(m.title || "")}</span>
          <span class="chip">${m.bpm || 90} BPM · ${escapeHtml(m.keySignature || "")}</span>
          <span class="chip">🗣 Голос: ${escapeHtml(vp.voicePreset?.name || "")}</span>
        </div>

        <div class="day-text">${escapeHtml(day.text)}</div>

        <div class="row">
          <button id="btn-zip" class="btn accent">📁 Скачать папку дня (.zip)</button>
          <button id="btn-disk" class="btn ghost">💾 Сохранить папку на диск</button>
          <button id="btn-mic" class="btn small ghost">🎙 ${day.customVoiceDataUrl ? "Перезаписать свой голос" : "Записать свой голос"}</button>
        </div>

        ${
          m.embed && m.embed.embedUrl
            ? `<div class="section">
                <div class="eyebrow">ОФИЦИАЛЬНЫЙ ПЛЕЕР МУЗЫКАЛЬНОГО СЕРВИСА (${escapeHtml(m.embed.provider)})</div>
                <div class="embed">
                  <iframe src="${escapeHtml(m.embed.embedUrl)}" height="${m.embed.height || 100}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
                </div>
              </div>`
            : m.embed && m.embed.externalUrl
            ? `<div class="section">
                <a class="btn small ghost" href="${escapeHtml(m.embed.externalUrl)}" target="_blank" rel="noopener">↗ Открыть песню во внешнем музыкальном сервисе</a>
              </div>`
            : ""
        }

        <div class="section">
          <div class="eyebrow">ОБЪЯСНИМАЯ ЛОГИКА // ПОЧЕМУ ЭТОТ ДЕНЬ ВЫГЛЯДИТ ИМЕННО ТАК</div>
          <h3 style="margin-top:4px;">Как текст, фото и музыка превратились в форму</h3>
          <ul class="why">
            ${(vp.explanations || [])
              .map(
                e => `
              <li>
                <span class="src ${e.source === "ФОТО" ? "photo" : e.source === "МУЗЫКА" ? "music" : e.source === "СИСТЕМА" ? "rule" : ""}">${escapeHtml(e.source)}</span>
                <div>${escapeHtml(e.text)}</div>
              </li>`
              )
              .join("")}
          </ul>
        </div>

        <div class="section">
          <div class="eyebrow">ПАЛИТРА И ОСИ ОЩУЩЕНИЯ ДНЯ</div>
          <div class="palette" style="margin: 10px 0 18px;">
            ${(pal.swatches || []).map(hex => `<i style="background:${hex}" title="${hex}"></i>`).join("")}
          </div>
          <div class="meters">
            ${renderMeter("Теплота", vp.scores.warmth, -1, 1)}
            ${renderMeter("Валентность (Радость)", vp.scores.valence, -1, 1)}
            ${renderMeter("Энергия и темп", vp.scores.arousal, -1, 1)}
            ${renderMeter("Напряжение / Фокус", vp.scores.tension, 0, 1)}
            ${renderMeter("Ностальгия / Память", vp.scores.nostalgia, 0, 1)}
            ${renderMeter("Воздух паспарту", (vp.layout.marginAir - 30) / 50, 0, 1, `${vp.layout.marginAir}px`)}
          </div>
        </div>

        <div class="section">
          <div class="eyebrow">ПЕРЕКЛЮЧИТЬ ХУДОЖЕСТВЕННЫЙ ПРИЁМ (ДЛЯ СРАВНЕНИЯ)</div>
          <div class="row" style="margin-top: 8px;">
            ${Object.values(TECHNIQUES)
              .map(
                t =>
                  `<button class="btn small ${t.id === vp.techniqueId ? "primary" : "ghost"}" data-switch-tech="${t.id}">${escapeHtml(t.name)}</button>`
              )
              .join("")}
          </div>
        </div>

        <div class="section">
          <div class="eyebrow">СТРУКТУРА СОХРАНЁННОЙ ПАПКИ ДНЯ</div>
          <div class="files" style="margin-top: 8px;">
            <div class="dir">📁 ${escapeHtml(day.folderTitle)}/</div>
            <div>├─ 📄 note.txt <span class="muted">(текст записи, дата, место, объяснимая логика)</span></div>
            <div>├─ 🖼 memory_poster.jpg <span class="muted">(готовое воспоминание 720×1280)</span></div>
            <div>├─ 🎬 memory_video.webm <span class="muted">(анимированная сцена с музыкой)</span></div>
            <div>├─ 📁 photos/ <span class="muted">(${(day.photos || []).length} фото дня: photo_1.jpg...)</span></div>
            <div>├─ 📁 music/ <span class="muted">(${m.url ? "track.wav + " : ""}music_analysis.json · ${m.bpm} BPM, ${escapeHtml(m.keySignature || "")})</span></div>
            <div>├─ 📁 voiceover/ <span class="muted">(voice_preset.json · тембр «${escapeHtml(vp.voicePreset?.name || "")}»${day.customVoiceDataUrl ? " + voice_recording.webm" : ""})</span></div>
            <div>└─ ⚙ visual_passport.json <span class="muted">(параметры визуальной системы)</span></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const canvas = document.getElementById("day-canvas");
  const stageBox = document.getElementById("stage-box");
  const playBtn = document.getElementById("btn-play");
  const barEl = document.getElementById("stage-bar");

  activeStagePlayer = await createLiveStagePlayer({
    canvas,
    day,
    onTimeUpdate: (cur, total) => {
      if (barEl) barEl.style.width = `${((cur / total) * 100).toFixed(1)}%`;
    },
    onStateChange: isPlaying => {
      stageBox.classList.toggle("playing", isPlaying);
      playBtn.textContent = isPlaying ? "⏸ Пауза" : "▶ Оживить сцену + музыку";
    }
  });

  stageBox.addEventListener("click", () => activeStagePlayer.toggle());
  playBtn.addEventListener("click", () => activeStagePlayer.toggle());
  document.getElementById("stage-timeline")?.addEventListener("click", e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const norm = (e.clientX - rect.left) / Math.max(1, rect.width);
    activeStagePlayer.seek(norm);
  });

  // Озвучка текста голосом под атмосферу дня
  const voiceBtn = document.getElementById("btn-voice");
  voiceBtn.addEventListener("click", () => {
    if (isVoiceSpeaking()) {
      stopVoiceover();
      voiceBtn.textContent = "🔊 Озвучить голосом дня";
      return;
    }
    speakDayEntry(day, {
      onStart: () => {
        voiceBtn.textContent = `⏹ Остановить озвучку (${vp.voicePreset?.name})`;
      },
      onEnd: () => {
        voiceBtn.textContent = "🔊 Озвучить голосом дня";
      }
    });
  });

  // Запись собственного голоса с микрофона
  const micBtn = document.getElementById("btn-mic");
  micBtn.addEventListener("click", async () => {
    if (micRecorder) {
      const dataUrl = await micRecorder.stop();
      micRecorder = null;
      day.customVoiceDataUrl = dataUrl;
      await saveDay(day);
      showToast("Живая озвучка сохранена в папку дня!");
      renderDayDetailView(day.id);
      return;
    }
    try {
      micRecorder = await createMicRecorder();
      micBtn.textContent = "⏹ Остановить запись голоса";
      micBtn.classList.add("accent");
      showToast("Говорите: идёт запись голоса для папки дня...");
    } catch (_) {
      showToast("Не удалось получить доступ к микрофону");
    }
  });

  // Запись и скачивание видео .webm со звуком
  const recVideoBtn = document.getElementById("btn-rec-video");
  recVideoBtn.addEventListener("click", async () => {
    recVideoBtn.disabled = true;
    recVideoBtn.textContent = "⏺ Запись видео (10 с)...";
    showToast("Записываем 10-секундное видео воспоминания со звуком...");
    const blob = await activeStagePlayer.recordVideoWebM(10);
    recordedVideoBlob = blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${day.folderTitle}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    recVideoBtn.disabled = false;
    recVideoBtn.textContent = "✓ Видео скачано (.webm)";
    showToast("Видео воспоминания сохранено и добавлено в пакет папки дня!");
  });

  // Скачивание папки дня (.zip)
  document.getElementById("btn-zip")?.addEventListener("click", async () => {
    showToast(`Упаковываем папку «${day.folderTitle}»...`);
    await downloadDayFolderZip(day, recordedVideoBlob);
  });

  // Прямая запись папки на диск
  document.getElementById("btn-disk")?.addEventListener("click", async () => {
    try {
      const res = await saveDayFolderToDisk(day, recordedVideoBlob);
      if (res.mode === "directory") {
        showToast(`Папка «${res.folderName}» создана на вашем диске!`);
      }
    } catch (_) {}
  });

  // Переключение художественного приёма на лету
  document.querySelectorAll("[data-switch-tech]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const forcedTechniqueId = btn.getAttribute("data-switch-tech");
      day.passport = buildVisualPassport({
        textAnalysis: day.textAnalysis,
        photoAnalysis: day.photoAnalysis,
        musicAnalysis: day.musicAnalysis,
        forcedTechniqueId
      });
      day.posterDataUrl = await renderPosterDataUrl(day);
      await saveDay(day);
      renderDayDetailView(day.id);
    });
  });

  // Удаление дня
  document.getElementById("btn-del-day")?.addEventListener("click", async () => {
    await deleteDay(day.id);
    showToast("Запись удалена");
    window.location.hash = "#/";
  });
}

function renderMeter(label, val, min, max, customText = "") {
  const norm = Math.max(0, Math.min(1, (val - min) / (max - min)));
  const disp = customText || (min < 0 && val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2));
  return `
    <div class="meter">
      <div class="k"><span>${escapeHtml(label)}</span><span>${disp}</span></div>
      <div class="bar"><i style="left:0; width:${Math.round(norm * 100)}%"></i></div>
    </div>
  `;
}

// ============================================================================
// 4. СТРАНИЦА «ЕДИНЫЙ ВИЗУАЛЬНЫЙ ЯЗЫК» (МАНИФЕСТ И ПРОВЕРКА ЛЕНТОЙ)
// ============================================================================
async function renderSystemView() {
  daysCache = await getAllDays();

  viewEl.innerHTML = `
    <div class="eyebrow">04 // ЕДИНЫЙ ВИЗУАЛЬНЫЙ ЯЗЫК И ХУДОЖЕСТВЕННЫЕ ПРИЁМЫ</div>
    <h1>Правила, по которым ощущение дня превращается в форму</h1>
    <p class="lead">Дневник «Атмосфера» — это единая серия, а не случайные шаблоны. Каждая генерация подчиняется общим конструктивным инвариантам, внутри которых палитра, воздух, пластика мазков, ритм монтажа и тембр голоса управляются текстом, фотографиями и музыкой.</p>

    <div class="section">
      <h2>1. Постоянные элементы серии (Инварианты)</h2>
      <div class="sys-grid" style="margin-top: 14px;">
        ${SYSTEM_INVARIANTS.map(
          inv => `
          <div class="card">
            <h3>${escapeHtml(inv.name)}</h3>
            <p class="muted" style="margin:8px 0 0;">${escapeHtml(inv.desc)}</p>
          </div>`
        ).join("")}
      </div>
    </div>

    <div class="section">
      <h2>2. Как ввод управляет переменными элементами (Объяснимая логика)</h2>
      <div class="card" style="margin-top: 14px; overflow-x:auto;">
        <table class="table">
          <thead>
            <tr>
              <th>Источник ввода</th>
              <th>Что извлекает алгоритм</th>
              <th>На что влияет в визуальной системе</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Текст записи</strong></td>
              <td>5 осей настроения (валентность, энергия, теплота, напряжение, ностальгия), время суток, сезон, ключевая фраза-цитата и <strong>название папки из 3–7 слов</strong>.</td>
              <td>Выбирает художественный приём, рукописную строку внизу листа, название папки и тембр/скорость голоса озвучки.</td>
            </tr>
            <tr>
              <td><strong>Фотографии дня</strong></td>
              <td>5 доминирующих цветов (k-means кластеризация в RGB), средняя яркость, контраст, насыщенность и теплота света.</td>
              <td>Окрашивает мазки, геометрические акценты, световую вуаль и 5 цветовых плашек в «Паспорте ощущения».</td>
            </tr>
            <tr>
              <td><strong>Песня дня</strong></td>
              <td>Темп (BPM через автокорреляцию атак), лад (мажор/минор по хроматограмме Крумхансла), энергия (RMS) и спектральная яркость.</td>
              <td><strong>BPM</strong> задаёт длительность кадров и пульсацию графики; <strong>медленный минор</strong> расширяет поля паспарту («даёт больше воздуха») и приглушает цвета; <strong>быстрый минор</strong> включает жёсткую сетку Кандинского.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>3. Шесть художественных приёмов и референсов</h2>
      <div class="sys-grid">
        ${Object.values(TECHNIQUES)
          .map(
            t => `
          <div class="tech-card">
            <canvas data-tech-preview="${t.id}" width="360" height="450"></canvas>
            <h3>${escapeHtml(t.name)}</h3>
            <div class="ref">${escapeHtml(t.reference)}</div>
            <p><strong>Когда включается:</strong> ${escapeHtml(t.when)}</p>
            <p><strong>Почему работает:</strong> ${escapeHtml(t.why)}</p>
          </div>`
          )
          .join("")}
      </div>
    </div>

    <div class="section">
      <h2>4. Проверка лентой: ${daysCache.length} разных дней рядом</h2>
      <p class="muted">Все страницы принадлежат одному дневнику благодаря единому паспарту, штампу и типографике, но характер каждого дня считывается мгновенно:</p>
      <div class="strip" style="margin-top: 14px;">
        ${daysCache
          .map(
            d => `
          <a href="#/day/${encodeURIComponent(d.id)}" style="text-decoration:none;">
            <img src="${d.posterDataUrl || ""}" alt="${escapeHtml(d.folderTitle)}" />
            <div class="cap">«${escapeHtml(d.folderTitle)}»</div>
            <div class="mono muted" style="font-size:11px;">${escapeHtml(d.passport?.technique?.name || "")}</div>
          </a>`
          )
          .join("")}
      </div>
    </div>
  `;

  // Отрисуем мини-превью для каждого из 6 художественных приёмов
  document.querySelectorAll("[data-tech-preview]").forEach(async c => {
    const techId = c.getAttribute("data-tech-preview");
    const matchingDay = daysCache.find(d => d.passport?.techniqueId === techId) || daysCache[0];
    if (!matchingDay) return;
    const clone = JSON.parse(JSON.stringify(matchingDay));
    clone.passport = buildVisualPassport({
      textAnalysis: clone.textAnalysis,
      photoAnalysis: clone.photoAnalysis,
      musicAnalysis: clone.musicAnalysis,
      forcedTechniqueId: techId
    });
    const ctx = c.getContext("2d");
    const imgEl = new Image();
    imgEl.onload = () => {
      ctx.drawImage(imgEl, 0, 0, c.width, c.height);
    };
    imgEl.src = await renderPosterDataUrl(clone, 540, 960);
  });
}

// ============================================================================
// 5. НАСТРОЙКИ И УПРАВЛЕНИЕ АРХИВОМ
// ============================================================================
function renderSettingsView() {
  viewEl.innerHTML = `
    <div class="eyebrow">НАСТРОЙКИ ПРОТОТИПА</div>
    <h1>Управление архивом и данными</h1>
    <p class="lead">Все записи, фотографии и сгенерированные воспоминания хранятся локально в IndexedDB вашего браузера.</p>

    <div class="sys-grid" style="margin-top: 24px;">
      <div class="card">
        <h3>Демонстрационный набор (7 дней)</h3>
        <p class="muted">Пересобрать все 7 демонстрационных дней с разными настроениями (Моне, Кандинский, Матисс, Суми-э, Тарковский, Фридрих).</p>
        <button id="btn-reseed" class="btn primary" style="margin-top:10px;">↻ Пересобрать 7 демо-дней</button>
      </div>
      <div class="card">
        <h3>Экспорт всего дневника (.json)</h3>
        <p class="muted">Сохранить резервную копию всех метаданных, текстов и визуальных паспортов архива.</p>
        <button id="btn-export-json" class="btn" style="margin-top:10px;">⬇ Скачать архив JSON</button>
      </div>
    </div>
  `;

  document.getElementById("btn-reseed")?.addEventListener("click", async () => {
    await clearAllDays();
    await ensureInitialSeed();
    showToast("7 демонстрационных дней успешно пересобраны!");
    window.location.hash = "#/";
  });

  document.getElementById("btn-export-json")?.addEventListener("click", async () => {
    const all = await getAllDays();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "atmosfera-archive.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
}

// ============================================================================
// Утилиты
// ============================================================================
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", async () => {
  await ensureInitialSeed();
  await route();
});
