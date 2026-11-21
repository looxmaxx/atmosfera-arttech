// ============================================================================
// АТМОСФЕРА // Модуль мультимодального анализа (Текст + Фото + Музыка)
// ============================================================================

const STOP_WORDS = new Set([
  "и","в","во","на","с","со","к","ко","по","из","за","у","о","об","от","до","для",
  "не","ни","но","а","или","да","же","ли","бы","то","это","тот","эта","этот","эти",
  "как","так","что","чтобы","когда","где","тут","там","здесь","вот","уже","еще","ещё",
  "мы","я","ты","он","она","оно","они","вы","нас","мне","меня","мой","моя","мои","наш",
  "был","была","было","были","быть","есть","очень","просто","весь","всё","все","весь",
  "день","сегодня","вчера","потом","затем","после","перед","через","над","под","при"
]);

const LEXICON = [
  // Тепло, уют, спокойствие (Моне)
  { re: /парк|алле[яи]|листь[яев]|жёлт|желт|осен[ьи]|золотист|охр/g, v: 0.45, a: -0.35, w: 0.65, t: -0.2, n: 0.35, tag: "осень и парк", place: "Осенний парк", season: "осень" },
  { re: /какао|кофе|чай|чашк|тёпл|тепл|плед|уют|шарф|варежк|перчатк|свеч/g, v: 0.5, a: -0.3, w: 0.7, t: -0.25, n: 0.25, tag: "тепло и уют" },
  { re: /гулял|прогулк|разговаривал|бесед|вдвоём|вдвоем|девушк|парн|любим|рядом|долго/g, v: 0.55, a: -0.2, w: 0.55, t: -0.2, n: 0.3, tag: "близость" },
  { re: /пруд|озер|утк|отражен|тишин|спокойн|медленн|мягк/g, v: 0.35, a: -0.5, w: 0.3, t: -0.35, n: 0.25, tag: "покой" },

  // Напряжение, дедлайн, офис, ночь (Кандинский)
  { re: /срочн|сдач|дедлайн|релиз|проект|работ|офис|ноутбук|код|экран|монитор|таск/g, v: -0.15, a: 0.75, w: -0.55, t: 0.85, n: -0.2, tag: "фокус и дедлайн", place: "Ночной офис" },
  { re: /ночь|ночью|три часа|3 часа|до утра|бессонн|энергетик|наушник/g, v: -0.1, a: 0.55, w: -0.45, t: 0.65, n: 0.0, tag: "ночной ритм", tod: "ночь" },
  { re: /устал|напряж|стресс|нерв|спеш|горит|жёстк|жестк|холодн|собран/g, v: -0.35, a: 0.65, w: -0.6, t: 0.8, n: -0.1, tag: "напряжение" },

  // Радость, лето, море, праздник (Матисс)
  { re: /мор[ея]|пляж|волн|солнц|солнечн|жарк|лет[оа]|арбуз|песок|купал|прыгал/g, v: 0.85, a: 0.7, w: 0.75, t: -0.4, n: 0.1, tag: "солнце и море", place: "Берег моря", season: "лето" },
  { re: /друзь[яей]|компани|смеял|смех|радост|счастлив|весел|танц|музык|громк/g, v: 0.8, a: 0.65, w: 0.6, t: -0.3, n: 0.1, tag: "радость с друзьями" },
  { re: /день рождения|праздник|торт|свеч[иа]|шар[ыи]|конфетти|тост|бокал|поздравлял/g, v: 0.85, a: 0.8, w: 0.7, t: -0.2, n: 0.2, tag: "праздник", place: "Праздничный стол" },

  // Дождь, тишина, меланхолия (Суми-э / Ма)
  { re: /дожд[ьия]|ливень|капл[ия]|мокр|зонт|стекл[ое]|окн[оау]|серый|пасмурн|туман/g, v: -0.25, a: -0.65, w: -0.35, t: -0.1, n: 0.45, tag: "дождь и созерцание", place: "У окна в дождь" },
  { re: /один|одна|одиноч|тихо|книг[ауи]|читал|молча|груст|тоск|задумчив/g, v: -0.2, a: -0.6, w: -0.15, t: -0.15, n: 0.5, tag: "уединение" },

  // Первый снег, двор, ностальгия (Плёнка / Тарковский)
  { re: /снег|снежинк|снегопад|сугроб|зим[аы]|мороз|фонар[ьи]|двор|подъезд|след[ы]/g, v: 0.35, a: -0.35, w: 0.15, t: -0.2, n: 0.85, tag: "первый снег и память", place: "Старый двор", season: "зима" },
  { re: /детств|помн[юи]|прошл|старый|хрущёвк|панельк|окна свет|тихое чудо/g, v: 0.3, a: -0.3, w: 0.35, t: -0.2, n: 0.9, tag: "ностальгия" },

  // Горы, рассвет, простор, восторг (Фридрих / Таррелл)
  { re: /гор[ыа]|вершин|хребет|рассвет|восход|облак|туман внизу|палатк|рюкзак|троп[ае]|подъём/g, v: 0.75, a: 0.45, w: 0.35, t: 0.1, n: 0.3, tag: "простор и рассвет", place: "Горный хребет", tod: "рассвет" },
  { re: /дыхан|ветер|высот[ае]|небо|бесконечн|свобод|восторг/g, v: 0.7, a: 0.4, w: 0.25, t: 0.0, n: 0.25, tag: "высота и воздух" }
];

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ----------------------------------------------------------------------------
// 1. Анализ текста записи
// ----------------------------------------------------------------------------
export function analyzeText(rawText = "", meta = {}) {
  const text = (rawText || "").trim();
  const lower = text.toLowerCase();

  let valence = 0.1;   // [-1..1] грусть -> радость
  let arousal = -0.1;  // [-1..1] покой -> энергия
  let warmth = 0.1;    // [-1..1] холод -> тепло
  let tension = 0.15;  // [0..1] расслабленность -> напряжение
  let nostalgia = 0.2; // [0..1] сиюминутность -> память/ностальгия

  const matchedTags = [];
  let detectedPlace = "";
  let detectedSeason = "";
  let detectedTod = "";

  for (const rule of LEXICON) {
    const matches = lower.match(rule.re);
    if (matches && matches.length > 0) {
      const weight = Math.min(2.2, 0.85 + (matches.length - 1) * 0.35);
      valence += rule.v * weight * 0.45;
      arousal += rule.a * weight * 0.45;
      warmth += rule.w * weight * 0.45;
      tension += rule.t * weight * 0.4;
      nostalgia += rule.n * weight * 0.45;
      if (rule.tag && !matchedTags.includes(rule.tag)) matchedTags.push(rule.tag);
      if (rule.place && !detectedPlace) detectedPlace = rule.place;
      if (rule.season && !detectedSeason) detectedSeason = rule.season;
      if (rule.tod && !detectedTod) detectedTod = rule.tod;
    }
  }

  // Пунктуация и ритм фраз тоже влияют на возбуждение/напряжение
  const exclam = (text.match(/!/g) || []).length;
  const ellipsis = (text.match(/\.\.\.|…/g) || []).length;
  const sentences = text.split(/[.!?…]+/).map(s => s.trim()).filter(Boolean);
  const avgWords = sentences.length
    ? sentences.reduce((acc, s) => acc + s.split(/\s+/).length, 0) / sentences.length
    : 8;

  if (exclam > 0) arousal += Math.min(0.25, exclam * 0.08);
  if (ellipsis > 0) {
    arousal -= 0.15;
    nostalgia += 0.2;
  }
  if (avgWords < 6 && sentences.length >= 2) {
    // Короткие рубленые фразы -> ритм и напряжение
    tension += 0.15;
    arousal += 0.12;
  } else if (avgWords > 14) {
    // Длинные плавные предложения -> созерцательность
    arousal -= 0.12;
  }

  // Учёт погоды из метаданных, если пользователь её указал
  if (meta.weather) {
    const w = meta.weather.toLowerCase();
    if (w.includes("солн") || w.includes("ясно")) { warmth += 0.2; valence += 0.15; }
    if (w.includes("дожд") || w.includes("пасмур")) { warmth -= 0.15; arousal -= 0.2; }
    if (w.includes("снег") || w.includes("мороз")) { nostalgia += 0.2; warmth -= 0.1; }
  }

  valence = clamp(valence, -1, 1);
  arousal = clamp(arousal, -1, 1);
  warmth = clamp(warmth, -1, 1);
  tension = clamp(tension, 0, 1);
  nostalgia = clamp(nostalgia, 0, 1);

  // Извлечение ключевых существительных/образов
  const words = lower
    .replace(/[^а-яёa-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w));
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(e => e[0]);

  // Выбор лучшей короткой цитаты для рукописной подписи на карточке
  let quote = sentences[0] || text || "Мгновение, которое хочется сохранить.";
  for (const s of sentences) {
    if (s.length >= 22 && s.length <= 92) {
      quote = s;
      break;
    }
  }
  if (quote.length > 96) quote = quote.slice(0, 93).trim() + "…";

  const folderTitle = buildFolderTitle(text, lower, meta, {
    valence, arousal, warmth, tension, nostalgia, detectedPlace, detectedSeason, detectedTod
  });

  return {
    valence,
    arousal,
    warmth,
    tension,
    nostalgia,
    tags: matchedTags.length ? matchedTags : ["личное мгновение"],
    keywords,
    quote,
    folderTitle,
    place: meta.location || detectedPlace || "Личное пространство",
    season: detectedSeason || inferSeasonFromDate(meta.date),
    timeOfDay: detectedTod || inferTimeOfDay(lower)
  };
}

function inferSeasonFromDate(dateStr) {
  if (!dateStr) return "осень";
  const m = new Date(dateStr).getMonth() + 1;
  if (m === 12 || m <= 2) return "зима";
  if (m >= 3 && m <= 5) return "весна";
  if (m >= 6 && m <= 8) return "лето";
  return "осень";
}

function inferTimeOfDay(lower) {
  if (/рассвет|утро|утром|заря/.test(lower)) return "утро";
  if (/ночь|ночью|полночь|3 часа|до утра/.test(lower)) return "ночь";
  if (/вечер|вечером|закат|сумерк/.test(lower)) return "вечер";
  return "день";
}

// Формирует короткое название папки дня в едином тоне (3-7 слов, именительный строй)
export function buildFolderTitle(text, lower, meta, mood) {
  if (meta && meta.customTitle && meta.customTitle.trim()) {
    return normalizeFolderTitle(meta.customTitle.trim());
  }
  // Правила образного именования 3-7 слов в едином стиле дневника:
  if (/парк/.test(lower) && /какао/.test(lower)) return "Осенний парк и горячее какао";
  if (/парк/.test(lower) && /пруд/.test(lower)) return "Вечер осенью у тихого пруда";
  if ((/офис/.test(lower) || /сдач/.test(lower) || /проект/.test(lower)) && /ночь/.test(lower)) {
    return "Ночь в офисе перед сдачей";
  }
  if (/мор[ея]/.test(lower) && /арбуз/.test(lower)) return "Солнечное море и арбуз с друзьями";
  if (/мор[ея]|пляж/.test(lower)) return "Солнечный день у синего моря";
  if (/дожд/.test(lower) && (/чай/.test(lower) || /книг/.test(lower))) return "Дождь за окном и тихий чай";
  if (/дожд/.test(lower)) return "Серый дождь и тишина у окна";
  if (/снег/.test(lower) && (/двор/.test(lower) || /фонар/.test(lower))) return "Первый снег в старом дворе";
  if (/снег/.test(lower)) return "Тихий вечер и первый снег";
  if (/гор[ыа]|вершин/.test(lower) && /рассвет|восход/.test(lower)) return "Рассвет в горах выше облаков";
  if (/гор[ыа]|палатк/.test(lower)) return "Утренний ветер на горном хребте";
  if (/день рождения|торт|свеч/.test(lower)) return "Свечи на торте и шум друзей";

  // Универсальный конструктор из 4-6 слов по смыслу записи
  const todMap = { утро: "Раннее утро", рассвет: "Тихий рассвет", день: "Длинный день", вечер: "Тёплый вечер", ночь: "Поздняя ночь" };
  const head = todMap[mood.detectedTod] || (mood.warmth > 0.25 ? "Тёплый вечер" : mood.tension > 0.55 ? "Собранный час" : "Тихий день");

  const cleanWords = (text || "")
    .replace(/[^а-яёa-z\s-]/gi, " ")
    .split(/\s+/)
    .map(w => w.toLowerCase())
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w));

  if (cleanWords.length >= 2) {
    return normalizeFolderTitle(`${head} и ${cleanWords[0]} ${cleanWords[1]}`);
  }
  if (cleanWords.length === 1) {
    return normalizeFolderTitle(`${head} и тихий ${cleanWords[0]}`);
  }
  return "Тихий вечер наедине с собой";
}

export function normalizeFolderTitle(title) {
  const words = title.replace(/[«»"']/g, "").trim().split(/\s+/).filter(Boolean);
  const sliced = words.slice(0, 7);
  while (sliced.length < 3) sliced.push("дня");
  const res = sliced.join(" ");
  return res.charAt(0).toUpperCase() + res.slice(1);
}

// ----------------------------------------------------------------------------
// 2. Компьютерное зрение на Canvas: анализ фотографий дня
// ----------------------------------------------------------------------------
export async function analyzePhotos(photoSources = []) {
  if (!photoSources || photoSources.length === 0) {
    return defaultPhotoStats();
  }

  const samples = [];
  let totalLum = 0;
  let totalLumSq = 0;
  let totalWarmth = 0;
  let totalSat = 0;
  let pixelCount = 0;

  for (const src of photoSources) {
    const img = await loadImage(src);
    const canvas = document.createElement("canvas");
    const w = 72;
    const h = 72;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    for (let i = 0; i < data.length; i += 8) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const sat = max === 0 ? 0 : (max - min) / max;
      const warm = ((r - b) + 0.35 * (g - b)) / 255;

      totalLum += lum;
      totalLumSq += lum * lum;
      totalWarmth += warm;
      totalSat += sat;
      pixelCount++;
      samples.push([r, g, b]);
    }
  }

  const meanLum = totalLum / Math.max(1, pixelCount);
  const contrast = Math.sqrt(Math.max(0, totalLumSq / Math.max(1, pixelCount) - meanLum * meanLum));
  const warmth = clamp((totalWarmth / Math.max(1, pixelCount)) * 1.9, -1, 1);
  const saturation = clamp(totalSat / Math.max(1, pixelCount), 0, 1);

  const palette = extractDominantColors(samples, 5);

  return {
    count: photoSources.length,
    palette, // массив из 5 HEX-цветов
    luminance: Number(meanLum.toFixed(2)),
    contrast: Number(contrast.toFixed(2)),
    warmth: Number(warmth.toFixed(2)),
    saturation: Number(saturation.toFixed(2)),
    lightCharacter: meanLum > 0.62 ? "яркий дневной свет" : meanLum < 0.34 ? "глубокие ночные тени" : "мягкий рассеянный свет"
  };
}

function extractDominantColors(samples, k = 5) {
  if (!samples.length) return ["#c97a3e", "#e3b878", "#6d5843", "#2d2926", "#f2e9dc"];
  // Детерминированная инициализация центроидов по квантилям яркости
  const sorted = [...samples].sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const centers = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.min(sorted.length - 1, Math.floor(((i + 0.5) / k) * sorted.length));
    centers.push([...sorted[idx]]);
  }

  for (let iter = 0; iter < 7; iter++) {
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const ctr = centers[c];
        const d = (p[0] - ctr[0]) ** 2 + (p[1] - ctr[1]) ** 2 + (p[2] - ctr[2]) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      sums[best][0] += p[0];
      sums[best][1] += p[1];
      sums[best][2] += p[2];
      sums[best][3] += 1;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centers[c][0] = Math.round(sums[c][0] / sums[c][3]);
        centers[c][1] = Math.round(sums[c][1] / sums[c][3]);
        centers[c][2] = Math.round(sums[c][2] / sums[c][3]);
      }
    }
  }

  return centers.map(([r, g, b]) => rgbToHex(r, g, b));
}

export function rgbToHex(r, g, b) {
  const h = n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function hexToRgb(hex) {
  const clean = (hex || "#000000").replace("#", "");
  const num = parseInt(clean, 16) || 0;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (src instanceof HTMLImageElement) return resolve(src);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = typeof src === "string" ? src : URL.createObjectURL(src);
  });
}

function defaultPhotoStats() {
  return {
    count: 1,
    palette: ["#354656", "#7a8b99", "#c89d66", "#dfd6c7", "#1e242b"],
    luminance: 0.5,
    contrast: 0.22,
    warmth: 0.05,
    saturation: 0.38,
    lightCharacter: "мягкий рассеянный свет"
  };
}

// ----------------------------------------------------------------------------
// 3. Аудиоанализ (Web Audio API DSP + парсинг ссылок на стриминги)
// ----------------------------------------------------------------------------
// Профили Крумхансла-Шмуклера для определения Мажора / Минора по 12 полутонам
const PROFILE_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const PROFILE_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "B♭", "B"];

export async function analyzeAudioSource(musicInput = {}) {
  // Если передан аудиофайл или URL локального демо-трека, декодируем реальное аудио
  if (musicInput.audioBlob || musicInput.audioUrl) {
    try {
      const arrayBuf = musicInput.audioBlob
        ? await musicInput.audioBlob.arrayBuffer()
        : await fetch(musicInput.audioUrl).then(r => r.arrayBuffer());
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
      await ctx.close();
      const dsp = analyzeAudioBufferDSP(audioBuf);
      return {
        sourceType: "file",
        title: musicInput.title || "Аудиозапись дня",
        artist: musicInput.artist || "Оригинальная дорожка",
        genre: musicInput.genre || inferGenreFromDsp(dsp),
        year: musicInput.year || "2026",
        url: musicInput.audioUrl || "",
        ...dsp
      };
    } catch (err) {
      console.warn("DSP fallback due to:", err);
    }
  }

  // Анализ по ссылке на музыкальный сервис и/или описанию песни
  return analyzeMusicFromMetadata(musicInput);
}

export function analyzeAudioBufferDSP(audioBuffer) {
  const sr = audioBuffer.sampleRate;
  const ch = audioBuffer.getChannelData(0);
  const totalSamples = ch.length;

  // 1) Энергия (RMS) и огибающая онсетов с шагом ~20 мс
  const hop = Math.max(128, Math.floor(sr * 0.02));
  const env = [];
  let sumSq = 0;
  let zeroCrossings = 0;

  for (let i = 0; i + hop < totalSamples; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) {
      const s = ch[i + j];
      e += s * s;
      if (j > 0 && ((ch[i + j] >= 0) !== (ch[i + j - 1] >= 0))) zeroCrossings++;
    }
    sumSq += e;
    env.push(Math.sqrt(e / hop));
  }

  const rms = Math.sqrt(sumSq / Math.max(1, totalSamples));
  const energy = clamp(rms * 3.6, 0.08, 0.98);
  const zcrRate = zeroCrossings / Math.max(1, totalSamples);
  const brightness = clamp(zcrRate * 14, 0.12, 0.95);

  // Дифференциальная огибающая атак (onset strength)
  const onsets = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) {
    onsets[i] = Math.max(0, env[i] - env[i - 1]);
  }

  // 2) Определение BPM автокорреляцией онсетов в диапазоне 60..150 BPM
  const fps = sr / hop;
  let bestLag = Math.round((fps * 60) / 96);
  let bestScore = -1;
  const minLag = Math.max(2, Math.floor((fps * 60) / 148));
  const maxLag = Math.min(onsets.length - 2, Math.ceil((fps * 60) / 58));

  for (let lag = minLag; lag <= maxLag; lag++) {
    let acc = 0;
    for (let i = 0; i + lag < onsets.length; i++) {
      acc += onsets[i] * onsets[i + lag];
    }
    // Поощряем гармоники в естественном музыкальном окне 75..135 BPM
    const candidateBpm = (fps * 60) / lag;
    const prior = 1 - 0.15 * Math.abs(candidateBpm - 105) / 60;
    const score = acc * prior;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  const bpm = Math.round(clamp((fps * 60) / bestLag, 58, 152));

  // 3) Хроматограмма (Goertzel по 12 полутонам в 3 октавах) -> Мажор / Минор
  const chroma = new Float32Array(12);
  const sliceLen = Math.min(totalSamples, sr * 12);
  const startOffset = Math.max(0, Math.floor((totalSamples - sliceLen) / 2));
  const step = 2; // субдискретизация для скорости

  for (let pc = 0; pc < 12; pc++) {
    let energyPc = 0;
    for (const octave of [3, 4, 5]) {
      const midi = 12 * (octave + 1) + pc;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      energyPc += goertzelMagnitude(ch, startOffset, Math.min(sliceLen, 16384), sr, freq, step);
    }
    chroma[pc] = energyPc;
  }

  let bestMode = "major";
  let bestKey = "C";
  let bestCorr = -Infinity;

  for (let root = 0; root < 12; root++) {
    let corrMaj = 0;
    let corrMin = 0;
    for (let i = 0; i < 12; i++) {
      const c = chroma[(root + i) % 12];
      corrMaj += c * PROFILE_MAJOR[i];
      corrMin += c * PROFILE_MINOR[i];
    }
    if (corrMaj > bestCorr) {
      bestCorr = corrMaj;
      bestMode = "major";
      bestKey = NOTE_NAMES[root];
    }
    if (corrMin > bestCorr) {
      bestCorr = corrMin;
      bestMode = "minor";
      bestKey = NOTE_NAMES[root];
    }
  }

  // Компактная 32-точечная огибающая для отрисовки звуковой партитуры на карточке
  const waveform = [];
  const buckets = 32;
  for (let b = 0; b < buckets; b++) {
    const idx = Math.min(env.length - 1, Math.floor((b / buckets) * env.length));
    waveform.push(Number(clamp(env[idx] * 2.8, 0.08, 1).toFixed(2)));
  }

  return {
    bpm,
    mode: bestMode,
    keySignature: `${bestKey} ${bestMode === "major" ? "мажор" : "минор"}`,
    energy: Number(energy.toFixed(2)),
    brightness: Number(brightness.toFixed(2)),
    waveform
  };
}

function goertzelMagnitude(buf, offset, length, sr, targetFreq, step = 2) {
  const effSr = sr / step;
  const N = Math.floor(length / step);
  const k = Math.round((N * targetFreq) / effSr);
  const w = (2 * Math.PI * k) / N;
  const cosine = Math.cos(w);
  const coeff = 2 * cosine;
  let q0 = 0, q1 = 0, q2 = 0;
  for (let i = 0; i < N; i++) {
    q0 = coeff * q1 - q2 + buf[offset + i * step];
    q2 = q1;
    q1 = q0;
  }
  return Math.sqrt(Math.max(0, q1 * q1 + q2 * q2 - q1 * q2 * coeff)) / Math.max(1, N);
}

function inferGenreFromDsp(dsp) {
  if (dsp.bpm >= 122 && dsp.energy > 0.6) return dsp.mode === "minor" ? "electronic / techno" : "dance / pop";
  if (dsp.bpm <= 76) return "ambient / piano";
  if (dsp.mode === "major" && dsp.bpm < 96) return "jazz / traditional pop";
  return "indie / atmospheric";
}

export function analyzeMusicFromMetadata(input = {}) {
  const raw = `${input.title || ""} ${input.artist || ""} ${input.genre || ""} ${input.url || ""}`.toLowerCase();
  let bpm = Number(input.bpm) || 96;
  let mode = input.mode || "major";
  let energy = 0.52;
  let brightness = 0.5;
  let genre = input.genre || "indie";

  if (/sinatra|jazz|вальс|waltz|swing|bossa|acoustic|акустик/.test(raw)) {
    bpm = Number(input.bpm) || 84;
    mode = input.mode || "major";
    energy = 0.38;
    brightness = 0.36;
    genre = "vocal jazz / traditional pop";
  } else if (/techno|electronic|электрон|synth|house|dnb|aphex|bicep|prodigy|cyber/.test(raw)) {
    bpm = Number(input.bpm) || 128;
    mode = input.mode || "minor";
    energy = 0.86;
    brightness = 0.78;
    genre = "electronic / IDM";
  } else if (/ambient|piano|пианино|дождь|rain|satie|дебюсси|ноктюрн|lo-fi|lofi/.test(raw)) {
    bpm = Number(input.bpm) || 64;
    mode = input.mode || "minor";
    energy = 0.24;
    brightness = 0.28;
    genre = "neoclassical / ambient";
  } else if (/funk|pop|disco|summer|лето|dance|праздник|upbeat/.test(raw)) {
    bpm = Number(input.bpm) || 120;
    mode = input.mode || "major";
    energy = 0.82;
    brightness = 0.74;
    genre = "sunshine pop / funk";
  } else if (/retro|80s|кино|synthwave|new wave|пост-панк/.test(raw)) {
    bpm = Number(input.bpm) || 94;
    mode = input.mode || "minor";
    energy = 0.48;
    brightness = 0.46;
    genre = "retro synth / new wave";
  } else if (/post-rock|cinematic|оркестр|hans zimmer|sigur/.test(raw)) {
    bpm = Number(input.bpm) || 100;
    mode = input.mode || "major";
    energy = 0.64;
    brightness = 0.62;
    genre = "cinematic / post-rock";
  }

  if (input.mode === "minor" || /минор|minor|грустн/.test(raw)) mode = "minor";
  if (input.mode === "major" || /мажор|major|светл/.test(raw)) mode = "major";

  const waveform = Array.from({ length: 32 }, (_, i) => {
    const phase = (i / 32) * Math.PI * 2;
    const v = energy * (0.62 + 0.35 * Math.sin(phase * (bpm / 30) + i * 0.7));
    return Number(clamp(v, 0.1, 0.98).toFixed(2));
  });

  return {
    sourceType: input.url ? "link" : "meta",
    title: input.title || "Песня этого дня",
    artist: input.artist || "Любимый исполнитель",
    genre,
    year: input.year || "2026",
    url: input.url || "",
    embed: parseStreamingEmbed(input.url || ""),
    bpm,
    mode,
    keySignature: mode === "major" ? "F мажор" : "A минор",
    energy: Number(energy.toFixed(2)),
    brightness: Number(brightness.toFixed(2)),
    waveform
  };
}

export function parseStreamingEmbed(url = "") {
  const u = (url || "").trim();
  if (!u) return null;

  // Spotify track
  const sp = u.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/);
  if (sp) {
    return {
      provider: "Spotify",
      embedUrl: `https://open.spotify.com/embed/track/${sp[1]}`,
      height: 80
    };
  }
  // YouTube
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) {
    return {
      provider: "YouTube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt[1]}`,
      height: 180
    };
  }
  // Яндекс.Музыка
  const ym = u.match(/music\.yandex\.[a-z]+\/album\/(\d+)\/track\/(\d+)/);
  if (ym) {
    return {
      provider: "Яндекс Музыка",
      embedUrl: `https://music.yandex.ru/iframe/track/${ym[2]}/${ym[1]}`,
      height: 110
    };
  }
  return { provider: "Музыкальная ссылка", externalUrl: u };
}
