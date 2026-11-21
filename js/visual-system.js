// ============================================================================
// АТМОСФЕРА // Единый визуальный язык и правила трансформации ощущения в форму
// ============================================================================

import { hexToRgb, rgbToHex } from "./analyze.js";

export const TECHNIQUES = {
  monet: {
    id: "monet",
    name: "Импрессионизм и мягкий свет",
    reference: "Клод Моне · серия «Тополя» и «Кувшинки», плёнка Kodak Portra",
    when: "Тёплые, спокойные, уютные дни: прогулка в парке, какао, долгий разговор с близким человеком.",
    why: "Мягкие полупрозрачные мазки растворяют жёсткие контуры цифровой фотографии и оставляют то, что удерживает память — тёплое пятно света, охру листвы и мягкое дыхание кадра.",
    frameStyle: "soft-arch",
    cutType: "dissolve",
    fontMood: "editorial-hand"
  },
  kandinsky: {
    id: "kandinsky",
    name: "Геометрический ритм и сетка",
    reference: "Василий Кандинский · «Точка и линия на плоскости», «Композиция VIII», Баухаус",
    when: "Напряжённые, собранные дни, ночной фокус, дедлайн в офисе, быстрая электронная музыка.",
    why: "Холодная сине-серая палитра, жёсткая модульная сетка, диагональные векторы и геометрические акценты передают внутреннюю собранность, пульс дедлайна и электрический ритм ночи.",
    frameStyle: "bauhaus-grid",
    cutType: "hard-cut",
    fontMood: "mono-construct"
  },
  matisse: {
    id: "matisse",
    name: "Солнечный декупаж и фовизм",
    reference: "Анри Матисс · бумажные вырезки «Джаз», средиземноморский свет",
    when: "Радостные, солнечные, праздничные дни: море с друзьями, смех, день рождения, танцы.",
    why: "Чистые открытые цвета, крупные органические аппликации-вырезки и бодрый шаг смены кадров передают избыток солнца, движения и живой энергии компании.",
    frameStyle: "collage-cutout",
    cutType: "bounce-slide",
    fontMood: " expressive-serif"
  },
  sumie: {
    id: "sumie",
    name: "Тушь Суми-э и пространство «Ма»",
    reference: "Японская минималистичная графика Суми-э, эстетика пустоты Ма (間), Тохаку Хасэгава",
    when: "Тихие, дождливые, созерцательные и меланхоличные дни наедине с собой.",
    why: "Увеличенные поля свободного «воздуха», приглушённые тушевые и шалфейные тона и тонкие вертикальные нити дождя дают записи тишину и паузу для дыхания.",
    frameStyle: "wide-passepartout",
    cutType: "slow-mist",
    fontMood: "quiet-serif"
  },
  tarkovsky: {
    id: "tarkovsky",
    name: "Память на аналоговой плёнке",
    reference: "Андрей Тарковский · «Зеркало», полароиды, плёнка Kodachrome и советский лирический модернизм",
    when: "Ностальгические вечера, первый снег в старом дворе, тихое чудо и воспоминания детства.",
    why: "Контраст холодных сумерек и тёплого янтарного гало фонаря, кружащаяся снежная взвесь и крупное плёночное зерно превращают кадр в живой отпечаток памяти.",
    frameStyle: "film-border",
    cutType: "film-fade",
    fontMood: "nostalgic-hand"
  },
  friedrich: {
    id: "friedrich",
    name: "Романтический горизонт и свет",
    reference: "Каспар Давид Фридрих · «Странник над морем тумана», световые поля Джеймса Таррелла",
    when: "Дни восторга и масштаба: рассвет в горах, поход, вершины выше облаков, дорога.",
    why: "Глубокий световой градиент неба, восходящие диагональные лучи и медленное панорамное раскрытие кадра передают ощущение высоты и свежего горного воздуха.",
    frameStyle: "panoramic-window",
    cutType: "horizon-rise",
    fontMood: "epic-serif"
  }
};

export const SYSTEM_INVARIANTS = [
  {
    name: "Формат страницы 9:16 (720×1280)",
    desc: "Каждый день — вертикальная страница одного альбома-дневника с едиными пропорциями, как для постера в ленте, так и для живого видео."
  },
  {
    name: "Архивное паспарту и рамка серии",
    desc: "Тонкая внутренняя рамка и бумажная фактура объединяют даже полярные по настроению дни (от тёплого Моне до холодного Кандинского) в одну книгу."
  },
  {
    name: "Верхний архивный штамп и печать",
    desc: "На каждой странице в одном и том же месте стоят индекс серии АТМОСФЕРА, дата, локация/погода и круглая цветовая печать дня."
  },
  {
    name: "Нижний «Паспорт ощущения»",
    desc: "Единый блок внизу страницы: короткое название папки (3–7 слов), рукописная цитата дня, строка песни с визуальной звуковой партитурой и 5 плашек палитры."
  }
];

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function buildVisualPassport({ textAnalysis, photoAnalysis, musicAnalysis, forcedTechniqueId = "" }) {
  const t = textAnalysis;
  const p = photoAnalysis;
  const m = musicAnalysis;

  // 1. Комбинированный вектор ощущения из 3 модальностей (Текст + Фото + Музыка)
  const musicValence = (m.mode === "major" ? 0.35 : -0.35) + (m.brightness - 0.5) * 0.4;
  const musicArousal = clamp(((m.bpm - 92) / 45) * 0.7 + (m.energy - 0.5) * 0.8, -1, 1);

  const combinedValence = clamp(t.valence * 0.52 + musicValence * 0.33 + p.warmth * 0.15, -1, 1);
  const combinedArousal = clamp(t.arousal * 0.48 + musicArousal * 0.42 + (p.saturation - 0.45) * 0.2, -1, 1);
  const combinedWarmth = clamp(t.warmth * 0.45 + p.warmth * 0.35 + (m.mode === "major" ? 0.2 : -0.2), -1, 1);
  const combinedTension = clamp(
    t.tension * 0.55 + (m.mode === "minor" && m.bpm >= 115 ? 0.35 : 0) + (p.contrast > 0.26 ? 0.12 : 0),
    0,
    1
  );

  // 2. Выбор художественного приёма по объяснимым правилам
  let techId = forcedTechniqueId;
  if (!techId || !TECHNIQUES[techId]) {
    if (combinedTension >= 0.48 || (m.bpm >= 118 && m.mode === "minor")) {
      techId = "kandinsky";
    } else if (t.nostalgia >= 0.52 && (t.season === "зима" || t.tags.includes("первый снег и память"))) {
      techId = "tarkovsky";
    } else if (t.tags.includes("простор и рассвет") || t.tags.includes("высота и воздух")) {
      techId = "friedrich";
    } else if (combinedArousal <= -0.28 && (combinedValence < 0.15 || t.tags.includes("дождь и созерцание"))) {
      techId = "sumie";
    } else if (combinedValence >= 0.48 && combinedArousal >= 0.2) {
      techId = "matisse";
    } else {
      techId = "monet";
    }
  }
  const technique = TECHNIQUES[techId];

  // 3. Построение палитры дня из цветов фотографий + сдвиг настроения и музыки
  const palette = deriveDayPalette(techId, p.palette, {
    warmth: combinedWarmth,
    valence: combinedValence,
    arousal: combinedArousal,
    tension: combinedTension,
    music: m
  });

  // 4. Расчёт параметров композиции, воздуха, фактуры и ритма от музыки
  // Медленная минорная песня даёт больше воздуха и приглушённые цвета:
  const slowMinorBonus = m.mode === "minor" && m.bpm < 85 ? 20 : 0;
  const marginAir = Math.round(clamp(44 + (1 - m.energy) * 24 + slowMinorBonus - combinedTension * 14, 34, 78));
  const beatSec = 60 / Math.max(55, m.bpm);
  const beatsPerPhoto = techId === "kandinsky" ? 4 : techId === "matisse" ? 6 : 8;
  const photoHoldSec = Number((beatSec * beatsPerPhoto).toFixed(2));
  const grainAmount = Number(
    clamp(techId === "tarkovsky" ? 0.34 : techId === "monet" ? 0.24 : techId === "kandinsky" ? 0.12 : 0.18, 0.08, 0.4).toFixed(2)
  );

  // 5. Подбор голоса озвучки по правилам системы
  const voicePreset = selectVoicePreset(techId, {
    valence: combinedValence,
    arousal: combinedArousal,
    tension: combinedTension,
    bpm: m.bpm
  });

  // 6. Объяснимая логика (почему этот день выглядит именно так)
  const explanations = buildExplanations({
    t,
    p,
    m,
    technique,
    palette,
    marginAir,
    photoHoldSec,
    voicePreset
  });

  return {
    techniqueId: techId,
    technique,
    scores: {
      valence: Number(combinedValence.toFixed(2)),
      arousal: Number(combinedArousal.toFixed(2)),
      warmth: Number(combinedWarmth.toFixed(2)),
      tension: Number(combinedTension.toFixed(2)),
      nostalgia: Number(t.nostalgia.toFixed(2))
    },
    palette,
    layout: {
      marginAir,
      frameStyle: technique.frameStyle,
      cutType: technique.cutType,
      gridDensity: techId === "kandinsky" ? 8 : techId === "sumie" ? 2 : 4
    },
    rhythm: {
      bpm: m.bpm,
      beatSec: Number(beatSec.toFixed(3)),
      photoHoldSec,
      grainAmount,
      motionSpeed: Number(clamp(m.bpm / 100, 0.55, 1.5).toFixed(2)),
      energy: m.energy
    },
    voicePreset,
    explanations
  };
}

function deriveDayPalette(techId, photoHexes = [], ctx) {
  const base = photoHexes.length >= 5
    ? photoHexes
    : ["#4a5568", "#718096", "#c89d66", "#e2d9c8", "#1f242b"];

  // Смешиваем доминирующие цвета фотографий с характерным тоном художественного приёма
  const presets = {
    monet: {
      bg: "#f2e6d0",
      bg2: "#e4cfa8",
      ink: "#2b2118",
      accent: "#c86428",
      accent2: "#d99b38",
      tint: [224, 154, 72]
    },
    kandinsky: {
      bg: "#171e29",
      bg2: "#243040",
      ink: "#e9eef5",
      accent: "#4a8fe7",
      accent2: "#e04f3e",
      tint: [72, 118, 178]
    },
    matisse: {
      bg: "#f7efe0",
      bg2: "#f2dfbe",
      ink: "#19232d",
      accent: "#e34a2e",
      accent2: "#16858d",
      tint: [242, 178, 68]
    },
    sumie: {
      bg: "#e6e8e4",
      bg2: "#d3d8d2",
      ink: "#222826",
      accent: "#556b63",
      accent2: "#7d8c85",
      tint: [115, 132, 126]
    },
    tarkovsky: {
      bg: "#1d2432",
      bg2: "#2b3548",
      ink: "#f2eadb",
      accent: "#e09f45",
      accent2: "#7c99b8",
      tint: [215, 158, 78]
    },
    friedrich: {
      bg: "#232a3a",
      bg2: "#443846",
      ink: "#f5ede2",
      accent: "#e88554",
      accent2: "#f2be72",
      tint: [232, 142, 92]
    }
  };

  const preset = presets[techId] || presets.monet;
  // Подмешиваем реальный цвет из фотографий пользователя (35%), чтобы каждый день имел уникальную палитру снимков
  const photoMid = hexToRgb(base[Math.min(2, base.length - 1)]);
  const presetAccent = hexToRgb(preset.accent);
  const blendedAccent = rgbToHex(
    presetAccent[0] * 0.68 + photoMid[0] * 0.32,
    presetAccent[1] * 0.68 + photoMid[1] * 0.32,
    presetAccent[2] * 0.68 + photoMid[2] * 0.32
  );

  return {
    bg: preset.bg,
    bg2: preset.bg2,
    ink: preset.ink,
    accent: blendedAccent,
    accent2: preset.accent2,
    tintRgb: preset.tint,
    swatches: [preset.bg, blendedAccent, preset.accent2, base[1] || preset.bg2, base[3] || preset.ink],
    photoSwatches: base
  };
}

export function selectVoicePreset(techId, { valence, arousal, tension, bpm }) {
  if (techId === "kandinsky" || tension >= 0.5) {
    return {
      id: "focused",
      name: "Собранный и чёткий",
      rate: 1.08,
      pitch: 0.92,
      volume: 0.95,
      pauseMs: 220,
      reason: "Ночной фокус и высокий темп требуют собранной, ритмичной подачи без лишних пауз."
    };
  }
  if (techId === "matisse" || (valence > 0.5 && arousal > 0.25)) {
    return {
      id: "lively",
      name: "Живой и солнечный",
      rate: 1.06,
      pitch: 1.08,
      volume: 1.0,
      pauseMs: 260,
      reason: "Высокая энергия и мажорный строй озвучиваются светлым, живым и улыбчивым тоном."
    };
  }
  if (techId === "sumie") {
    return {
      id: "contemplative",
      name: "Тихий и задумчивый",
      rate: 0.86,
      pitch: 0.9,
      volume: 0.85,
      pauseMs: 520,
      reason: "Медленный ритм дождя и уединение требуют тихого голоса с длинными паузами между фразами."
    };
  }
  if (techId === "friedrich") {
    return {
      id: "airy",
      name: "Воздушный и вдохновенный",
      rate: 0.95,
      pitch: 1.0,
      volume: 0.95,
      pauseMs: 380,
      reason: "Простор гор и рассвет звучат ровно, глубоко и просторно."
    };
  }
  // monet / tarkovsky -> спокойный тёплый голос
  return {
    id: "warm",
    name: "Спокойный и тёплый",
    rate: 0.91,
    pitch: 0.95,
    volume: 0.92,
    pauseMs: 420,
    reason: "Уютный вечер и тёплая ностальгия звучат мягким, неторопливым голосом близкого друга."
  };
}

function buildExplanations({ t, p, m, technique, palette, marginAir, photoHoldSec, voicePreset }) {
  const list = [];

  list.push({
    source: "ТЕКСТ",
    label: "Текст записи",
    text: `В записи выделены мотивы: «${t.tags.join("», «")}» (теплота ${t.warmth >= 0 ? "+" : ""}${t.warmth.toFixed(2)}, напряжение ${t.tension.toFixed(2)}). Система дала папке название «${t.folderTitle}» и вынесла в рукописную подпись строку: «${t.quote}».`
  });

  list.push({
    source: "ФОТО",
    label: "Анализ снимков",
    text: `Из ${p.count} фото извлечена доминирующая палитра (${p.palette.slice(0, 3).join(", ")}) и характер света — ${p.lightCharacter} (яркость ${Math.round(p.luminance * 100)}%, насыщенность ${Math.round(p.saturation * 100)}%). Эти оттенки вплетены в акценты и мазки сцены.`
  });

  const modeWord = m.mode === "major" ? "мажорный лад" : "минорный лад";
  const tempoDesc = m.bpm < 80 ? "медленный созерцательный темп" : m.bpm > 116 ? "высокий пульсирующий темп" : "умеренный шаговый темп";
  list.push({
    source: "МУЗЫКА",
    label: "Влияние песни",
    text: `Песня «${m.title}» (${m.bpm} BPM, ${modeWord}, энергия ${Math.round(m.energy * 100)}%) задаёт ${tempoDesc}: кадры сменяются строго в долю каждые ${photoHoldSec} с, а поля паспарту раскрыты на ${marginAir} px (${m.mode === "minor" && m.bpm < 90 ? "медленный минор добавил больше воздуха и приглушил цвета" : "ритм песни управляет пульсацией графики и волны"}).`
  });

  list.push({
    source: "СИСТЕМА",
    label: "Художественный приём и голос",
    text: `Включён приём «${technique.name}» (${technique.reference}). ${technique.why} Озвучка: «${voicePreset.name}» (скорость ${voicePreset.rate}×, тон ${voicePreset.pitch}).`
  });

  return list;
}
