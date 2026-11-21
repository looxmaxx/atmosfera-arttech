// ============================================================================
// АТМОСФЕРА // Генеративный Canvas-рендерер воспоминания (Постер + Живое видео)
// ============================================================================

import { loadImage, hexToRgb } from "./analyze.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Детерминированный генератор псевдослучайных чисел для стабильных мазков и композиции
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str = "") {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ----------------------------------------------------------------------------
// Главная функция отрисовки одного кадра страницы дневника (720x1280)
// ----------------------------------------------------------------------------
export function drawDayFrame(ctx, W, H, day, images = [], tSec = 3.5, liveAudioLevel = null) {
  const vp = day.passport;
  const pal = vp.palette;
  const techId = vp.techniqueId;
  const bpm = vp.rhythm.bpm || 90;
  const beatSec = 60 / bpm;
  const beatCount = tSec / beatSec;
  const beatPhase = beatCount - Math.floor(beatCount); // 0..1 внутри доли
  const beatPulse = Math.exp(-beatPhase * 4.2); // резкий импульс в начале доли
  const energy = liveAudioLevel !== null ? liveAudioLevel : vp.rhythm.energy * (0.75 + 0.25 * beatPulse);

  const seed = hashString(day.id + (day.folderTitle || ""));
  const rng = mulberry32(seed);

  ctx.save();

  // 1. ФОН СТРАНИЦЫ (палитра дня)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, pal.bg);
  bgGrad.addColorStop(1, pal.bg2);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. ИНВАРИАНТ СЕРИИ: Архивная рамка и верхний колонтитул
  const pad = 26;
  ctx.strokeStyle = withAlpha(pal.ink, 0.22);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

  // Угловые архивные метки
  drawCornerMarks(ctx, pad + 6, pad + 6, W - (pad + 6) * 2, H - (pad + 6) * 2, pal.ink, 10);

  // Верхний штамп серии
  ctx.fillStyle = withAlpha(pal.ink, 0.72);
  ctx.font = '600 12px "JetBrains Mono", monospace';
  const seqStr = `АТМОСФЕРА // ПАПКА ДНЯ №${String(day.seq || 1).padStart(2, "0")}`;
  ctx.fillText(seqStr, pad + 20, pad + 30);

  ctx.fillStyle = withAlpha(pal.ink, 0.55);
  ctx.font = '400 11.5px "JetBrains Mono", monospace';
  const datePart = formatDateRu(day.date);
  const placePart = (day.textAnalysis?.place || day.location || "").toUpperCase();
  const weatherPart = day.weather ? ` · ${day.weather.toUpperCase()}` : "";
  ctx.fillText(`${datePart} · ${placePart}${weatherPart}`, pad + 20, pad + 50);

  // Круглая печать дня справа вверху
  drawArchivalSeal(ctx, W - pad - 44, pad + 38, 22, pal.accent, pal.ink, `${bpm}`, day.musicAnalysis?.mode === "minor" ? "MIN" : "MAJ");

  // Горизонтальный разделитель шапки
  ctx.beginPath();
  ctx.moveTo(pad + 16, pad + 70);
  ctx.lineTo(W - pad - 16, pad + 70);
  ctx.strokeStyle = withAlpha(pal.ink, 0.16);
  ctx.stroke();

  // 3. ЦЕНТРАЛЬНОЕ ОКНО ВОСПОМИНАНИЯ (с учётом воздуха marginAir)
  const air = vp.layout.marginAir || 48;
  const winX = air;
  const winY = 114;
  const winW = W - air * 2;
  const winH = 748 - (air - 44) * 1.1;

  drawPhotoWindow(ctx, {
    winX,
    winY,
    winW,
    winH,
    images,
    day,
    techId,
    tSec,
    beatCount,
    beatPhase,
    beatPulse,
    energy,
    rng
  });

  // 4. ХУДОЖЕСТВЕННЫЙ СЛОЙ ПОВЕРХ И ВОКРУГ КАДРА (Моне / Кандинский / Матисс / Суми-э / Тарковский / Фридрих)
  drawArtisticOverlay(ctx, {
    W,
    H,
    winX,
    winY,
    winW,
    winH,
    day,
    techId,
    tSec,
    beatCount,
    beatPhase,
    beatPulse,
    energy,
    rng
  });

  // 5. НИЖНИЙ «ПАСПОРТ ОЩУЩЕНИЯ» (инвариант серии)
  const footY = winY + winH + 28;
  drawSensationFooter(ctx, {
    W,
    H,
    pad,
    footY,
    day,
    tSec,
    beatPulse,
    energy
  });

  // 6. ПЛЁНОЧНОЕ ЗЕРНО И БУМАЖНАЯ ФАКТУРА
  drawFilmGrain(ctx, W, H, vp.rhythm.grainAmount || 0.2, tSec, pal.ink);

  ctx.restore();
}

// ----------------------------------------------------------------------------
// Отрисовка фотографий в окне с ритмом смены от музыки
// ----------------------------------------------------------------------------
function drawPhotoWindow(ctx, { winX, winY, winW, winH, images, day, techId, tSec, beatCount, beatPhase, beatPulse, rng }) {
  const vp = day.passport;
  const pal = vp.palette;
  const hold = vp.rhythm.photoHoldSec || 4.0;
  const n = Math.max(1, images.length);
  const rawIdx = tSec / hold;
  const idxA = Math.floor(rawIdx) % n;
  const idxB = (idxA + 1) % n;
  const localT = rawIdx - Math.floor(rawIdx); // 0..1

  // Длина перехода зависит от приёма: у Кандинского — резкий монтаж по биту, у Моне и Суми-э — мягкий наплыв
  const fadePortion = techId === "kandinsky" ? 0.06 : techId === "matisse" ? 0.16 : 0.34;
  const alphaB = localT > 1 - fadePortion ? (localT - (1 - fadePortion)) / fadePortion : 0;

  ctx.save();

  // Форма окна по приёму
  ctx.beginPath();
  if (techId === "monet") {
    roundRectPath(ctx, winX, winY, winW, winH, 18);
  } else if (techId === "matisse") {
    roundRectPath(ctx, winX, winY, winW, winH, 28);
  } else {
    ctx.rect(winX, winY, winW, winH);
  }
  ctx.clip();

  if (images.length > 0) {
    // Для Кандинского при 2+ фото делаем полиэкранный конструктивистский коллаж на сильных долях
    if (techId === "kandinsky" && images.length >= 2 && Math.floor(beatCount / 2) % 2 === 1) {
      const splitY = winY + winH * 0.56;
      drawCoverImage(ctx, images[idxA], winX, winY, winW, winH * 0.55, 1.04 + beatPulse * 0.03, 0, 0);
      drawCoverImage(ctx, images[idxB], winX, splitY, winW, winH * 0.44, 1.06, 0, 0);
    } else {
      // Дыхание кадра (Ken Burns) в темпе песни
      const zoomA = 1.03 + 0.07 * localT + (techId === "kandinsky" ? beatPulse * 0.025 : 0);
      const panAx = Math.sin(tSec * 0.35 + idxA) * 14;
      const panAy = Math.cos(tSec * 0.28 + idxA) * 10;
      drawCoverImage(ctx, images[idxA], winX, winY, winW, winH, zoomA, panAx, panAy);

      if (alphaB > 0 && images[idxB]) {
        ctx.globalAlpha = easeInOut(alphaB);
        const zoomB = 1.02 + 0.05 * alphaB;
        drawCoverImage(ctx, images[idxB], winX, winY, winW, winH, zoomB, -panAx * 0.5, -panAy * 0.5);
        ctx.globalAlpha = 1;
      }
    }
  } else {
    ctx.fillStyle = pal.accent;
    ctx.fillRect(winX, winY, winW, winH);
  }

  // Цветовая тонировка фотографии под настроение и музыку
  const [tr, tg, tb] = pal.tintRgb || [210, 150, 80];
  ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, ${techId === "kandinsky" ? 0.26 : techId === "sumie" ? 0.32 : 0.20})`;
  ctx.fillRect(winX, winY, winW, winH);

  // Мягкая виньетка внутри кадра
  const vig = ctx.createRadialGradient(
    winX + winW * 0.5,
    winY + winH * 0.48,
    winW * 0.25,
    winX + winW * 0.5,
    winY + winH * 0.5,
    winH * 0.72
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, techId === "tarkovsky" || techId === "kandinsky" ? "rgba(8,12,20,0.52)" : "rgba(25,18,12,0.28)");
  ctx.fillStyle = vig;
  ctx.fillRect(winX, winY, winW, winH);

  ctx.restore();

  // Тонкая обводка окна
  ctx.strokeStyle = withAlpha(pal.ink, techId === "kandinsky" ? 0.65 : 0.25);
  ctx.lineWidth = techId === "kandinsky" ? 2 : 1;
  ctx.strokeRect(winX, winY, winW, winH);
}

// ----------------------------------------------------------------------------
// 6 Художественных приёмов: генеративная графика поверх фотографии
// ----------------------------------------------------------------------------
function drawArtisticOverlay(ctx, params) {
  const { W, H, winX, winY, winW, winH, day, techId, tSec, beatPhase, beatPulse, energy, rng } = params;
  const pal = day.passport.palette;
  const sw = pal.photoSwatches || pal.swatches;

  ctx.save();

  if (techId === "monet") {
    // Импрессионистские мазки Клода Моне по краям и световым пятнам
    ctx.save();
    for (let i = 0; i < 85; i++) {
      const rx = rng();
      const ry = rng();
      // Концентрируем мазки ближе к контуру и нижней трети, чтобы не перекрывать центр сюжета
      const edgeBias = (rx < 0.22 || rx > 0.78 || ry < 0.18 || ry > 0.72) ? 1 : 0.38;
      const x = winX + rx * winW + Math.sin(tSec * 0.8 + i) * 6;
      const y = winY + ry * winH + Math.cos(tSec * 0.7 + i * 0.5) * 4;
      const w = (18 + rng() * 34) * (0.9 + 0.2 * Math.sin(tSec + i));
      const h = 6 + rng() * 11;
      const angle = -0.35 + rng() * 0.7 + Math.sin(tSec * 0.3 + i) * 0.08;
      const col = sw[i % sw.length] || pal.accent;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = withAlpha(col, 0.34 * edgeBias);
      ctx.beginPath();
      ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Мягкие золотистые блики света
    for (let i = 0; i < 18; i++) {
      const x = winX + rng() * winW;
      const y = winY + rng() * winH;
      const r = 16 + rng() * 42;
      const a = 0.08 + 0.08 * Math.sin(tSec * 1.4 + i);
      const g = ctx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, withAlpha(pal.accent2, a * 2.2));
      g.addColorStop(1, withAlpha(pal.accent2, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (techId === "kandinsky") {
    // Супрематическая и Баухаус-сетка + геометрическая композиция Кандинского
    ctx.save();
    // Модульная сетка
    ctx.strokeStyle = withAlpha(pal.ink, 0.16);
    ctx.lineWidth = 1;
    const cols = 6;
    const rows = 8;
    for (let c = 1; c < cols; c++) {
      const gx = winX + (winW / cols) * c;
      ctx.beginPath();
      ctx.moveTo(gx, winY);
      ctx.lineTo(gx, winY + winH);
      ctx.stroke();
    }
    for (let r = 1; r < rows; r++) {
      const gy = winY + (winH / rows) * r;
      ctx.beginPath();
      ctx.moveTo(winX, gy);
      ctx.lineTo(winX + winW, gy);
      ctx.stroke();
    }

    // Диагональные конструктивистские лучи и линии
    for (let i = 0; i < 7; i++) {
      const x1 = winX + rng() * winW;
      const y1 = winY + rng() * winH;
      const len = 110 + rng() * 220;
      const ang = (Math.floor(rng() * 6) * Math.PI) / 6;
      ctx.strokeStyle = i % 2 === 0 ? withAlpha(pal.ink, 0.75) : withAlpha(pal.accent, 0.85);
      ctx.lineWidth = i % 3 === 0 ? 3.2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
      ctx.stroke();
    }

    // Концентрические круги и геометрические пятна, пульсирующие в бит электронной музыки
    for (let i = 0; i < 6; i++) {
      const cx = winX + (0.15 + 0.7 * rng()) * winW;
      const cy = winY + (0.15 + 0.7 * rng()) * winH;
      const baseR = 18 + rng() * 48;
      const r = baseR * (1 + 0.18 * beatPulse * (i % 2 === 0 ? 1 : -0.5));
      const col = i % 2 === 0 ? pal.accent : pal.accent2;
      ctx.fillStyle = withAlpha(col, 0.42);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(pal.ink, 0.8);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 7, 0, Math.PI * 1.45);
      ctx.stroke();
    }
    ctx.restore();
  } else if (techId === "matisse") {
    // Солнечный декупаж Анри Матисса: органические вырезки по углам и солнечные блики
    ctx.save();
    const shapes = 10;
    for (let i = 0; i < shapes; i++) {
      const side = i % 4;
      const cx = side === 0 ? winX + 18 : side === 1 ? winX + winW - 18 : winX + rng() * winW;
      const cy = side === 2 ? winY + 22 : side === 3 ? winY + winH - 22 : winY + rng() * winH;
      const scale = (0.7 + rng() * 0.7) * (1 + 0.08 * Math.sin(tSec * 3 + i));
      const col = i % 2 === 0 ? pal.accent : pal.accent2;
      drawMatisseLeaf(ctx, cx, cy, scale, tSec * 0.6 + i, withAlpha(col, 0.58));
    }
    ctx.restore();
  } else if (techId === "sumie") {
    // Японская тушь Суми-э и нити дождя
    ctx.save();
    ctx.strokeStyle = withAlpha(pal.ink, 0.22);
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 42; i++) {
      const rx = winX + ((rng() * winW) | 0);
      const speed = 180 + rng() * 140;
      const ry = winY + ((rng() * winH + tSec * speed) % winH);
      const len = 18 + rng() * 28;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 2, Math.min(winY + winH, ry + len));
      ctx.stroke();
    }
    // Круги капель на воде
    for (let i = 0; i < 5; i++) {
      const rx = winX + (0.2 + 0.6 * rng()) * winW;
      const ry = winY + (0.3 + 0.55 * rng()) * winH;
      const phase = (tSec * 0.45 + i * 0.23) % 1;
      ctx.strokeStyle = withAlpha(pal.ink, (1 - phase) * 0.35);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(rx, ry, phase * 48, phase * 18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  } else if (techId === "tarkovsky") {
    // Плёночная перфорация/маркировка, тёплое янтарное гало фонаря и кружащийся снег
    ctx.save();
    // Тёплое гало света в верхней части кадра
    const halo = ctx.createRadialGradient(
      winX + winW * 0.68,
      winY + winH * 0.28,
      10,
      winX + winW * 0.68,
      winY + winH * 0.28,
      winW * 0.55
    );
    halo.addColorStop(0, "rgba(255, 196, 108, 0.34)");
    halo.addColorStop(0.5, "rgba(232, 148, 68, 0.14)");
    halo.addColorStop(1, "rgba(232, 148, 68, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(winX, winY, winW, winH);

    // Снежинки в свете фонаря
    for (let i = 0; i < 55; i++) {
      const sx = winX + ((rng() * winW + Math.sin(tSec * 0.9 + i) * 26 + winW) % winW);
      const sy = winY + ((rng() * winH + tSec * (32 + (i % 5) * 9)) % winH);
      const sr = 1.4 + (i % 4) * 0.9;
      ctx.fillStyle = withAlpha("#fff7e8", 0.45 + 0.35 * Math.sin(tSec + i));
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Плёночная маркировка на кромке
    ctx.save();
    ctx.fillStyle = withAlpha(pal.accent, 0.75);
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText("KODACHROME 64 // 24A", winX + 12, winY + winH - 12);
    ctx.fillText("► 24B", winX + winW - 52, winY + winH - 12);
    ctx.restore();
    ctx.restore();
  } else if (techId === "friedrich") {
    // Лучи рассвета и восходящая дымка над горным горизонтом
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const x0 = winX + winW * (0.2 + i * 0.12);
      const y0 = winY;
      const grad = ctx.createLinearGradient(x0, y0, x0 + 90, winY + winH);
      grad.addColorStop(0, withAlpha(pal.accent2, 0.18 + 0.05 * Math.sin(tSec + i)));
      grad.addColorStop(1, withAlpha(pal.accent, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + 55, y0);
      ctx.lineTo(x0 + 180, winY + winH);
      ctx.lineTo(x0 + 60, winY + winH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawMatisseLeaf(ctx, x, y, scale, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.bezierCurveTo(28, -28, 32, -4, 8, 6);
  ctx.bezierCurveTo(30, 14, 24, 34, 0, 38);
  ctx.bezierCurveTo(-24, 34, -30, 14, -8, 6);
  ctx.bezierCurveTo(-32, -4, -28, -28, 0, -34);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ----------------------------------------------------------------------------
// Нижний «Паспорт ощущения»: название папки, рукописная строка, песня и палитра
// ----------------------------------------------------------------------------
function drawSensationFooter(ctx, { W, H, pad, footY, day, tSec, beatPulse, energy }) {
  const vp = day.passport;
  const pal = vp.palette;
  const left = pad + 22;
  const right = W - pad - 22;
  const maxW = right - left;

  // Бейдж художественного приёма
  ctx.fillStyle = pal.accent;
  ctx.font = '600 11px "JetBrains Mono", monospace';
  const techBadge = `${vp.technique.name.toUpperCase()} · ${day.musicAnalysis?.bpm || 90} BPM · ${(day.musicAnalysis?.keySignature || "MAJ").toUpperCase()}`;
  ctx.fillText(techBadge, left, footY);

  // Название папки дня (3-7 слов в едином тоне)
  ctx.fillStyle = pal.ink;
  ctx.font = '600 38px "Cormorant Garamond", Georgia, serif';
  const titleLines = wrapText(ctx, `«${day.folderTitle}»`, maxW, 2);
  let curY = footY + 38;
  for (const line of titleLines) {
    ctx.fillText(line, left, curY);
    curY += 40;
  }

  // Рукописная подпись (проявляется по буквам в первые 3 секунды или видна целиком на постере)
  const quote = day.textAnalysis?.quote || day.text || "";
  const revealRatio = clamp(tSec / 2.6, 0.25, 1);
  const shownQuote = quote.slice(0, Math.ceil(quote.length * revealRatio));
  ctx.fillStyle = withAlpha(pal.ink, 0.86);
  ctx.font = '500 26px "Caveat", cursive';
  const quoteLines = wrapText(ctx, shownQuote, maxW, 2);
  curY += 4;
  for (const ql of quoteLines) {
    ctx.fillText(ql, left, curY);
    curY += 28;
  }

  // Блок песни и аудио-реактивной партитуры в самом низу страницы
  const musicY = H - pad - 74;
  ctx.strokeStyle = withAlpha(pal.ink, 0.16);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, musicY - 16);
  ctx.lineTo(right, musicY - 16);
  ctx.stroke();

  // Иконка ноты и название трека
  ctx.fillStyle = pal.ink;
  ctx.font = '600 12px "JetBrains Mono", monospace';
  const trackLabel = `♪ ${(day.musicAnalysis?.artist || "Исполнитель").toUpperCase()} — ${(day.musicAnalysis?.title || "Песня дня").toUpperCase()}`;
  ctx.fillText(trackLabel.slice(0, 48), left, musicY + 4);

  // 32 столбика звуковой волны песни
  const wave = day.musicAnalysis?.waveform || [];
  const barAreaW = 210;
  const barStartX = right - barAreaW;
  const barW = 4;
  const gap = (barAreaW - barW * 28) / 27;
  for (let i = 0; i < 28; i++) {
    const baseV = wave[i % Math.max(1, wave.length)] || 0.4;
    const animV = clamp(baseV * (0.65 + 0.45 * Math.sin(tSec * 5.2 + i * 0.45)) * (0.7 + 0.4 * energy), 0.12, 1);
    const bh = Math.round(animV * 24);
    const bx = barStartX + i * (barW + gap);
    const by = musicY - bh + 8;
    ctx.fillStyle = i % 4 === 0 ? pal.accent : withAlpha(pal.ink, 0.65);
    ctx.fillRect(bx, by, barW, bh);
  }

  // 5 цветовых плашек палитры дня + индекс папки
  const sw = pal.swatches || [];
  const swW = 28;
  const swH = 10;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = sw[i] || pal.accent;
    ctx.fillRect(left + i * (swW + 5), musicY + 24, swW, swH);
    ctx.strokeStyle = withAlpha(pal.ink, 0.25);
    ctx.strokeRect(left + i * (swW + 5), musicY + 24, swW, swH);
  }

  ctx.fillStyle = withAlpha(pal.ink, 0.55);
  ctx.font = '400 10.5px "JetBrains Mono", monospace';
  ctx.textAlign = "right";
  ctx.fillText(`ГОЛОС: ${(vp.voicePreset?.name || "ТЁПЛЫЙ").toUpperCase()}`, right, musicY + 33);
  ctx.textAlign = "left";
}

// ----------------------------------------------------------------------------
// Вспомогательные графические примитивы
// ----------------------------------------------------------------------------
function drawCoverImage(ctx, img, x, y, w, h, zoom = 1, panX = 0, panY = 0) {
  if (!img) return;
  const iw = img.naturalWidth || img.width || 720;
  const ih = img.naturalHeight || img.height || 960;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2 + panX;
  const dy = y + (h - dh) / 2 + panY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawArchivalSeal(ctx, cx, cy, r, accent, ink, topText, botText) {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = withAlpha(ink, 0.35);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.fillText(topText, cx, cy - 1);
  ctx.font = '400 8.5px "JetBrains Mono", monospace';
  ctx.fillText(botText, cx, cy + 10);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawCornerMarks(ctx, x, y, w, h, color, len = 10) {
  ctx.save();
  ctx.strokeStyle = withAlpha(color, 0.45);
  ctx.lineWidth = 1.4;
  const corners = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1]
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFilmGrain(ctx, W, H, amount, tSec, inkHex) {
  const [r, g, b] = hexToRgb(inkHex);
  const rng = mulberry32(Math.floor(tSec * 12) + 17);
  ctx.save();
  ctx.fillStyle = `rgba(${r},${g},${b},${amount * 0.22})`;
  const dots = Math.floor(420 * amount);
  for (let i = 0; i < dots; i++) {
    const x = (rng() * W) | 0;
    const y = (rng() * H) | 0;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, maxLines = 2) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.length ? lines : [""];
}

function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function formatDateRu(dateStr) {
  if (!dateStr) return "21 НОЯ 2026";
  const months = ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЯ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).toUpperCase();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ----------------------------------------------------------------------------
// Генерация статичного постера (DataURL JPEG/PNG)
// ----------------------------------------------------------------------------
export async function renderPosterDataUrl(day, width = 720, height = 1280) {
  const imgs = await Promise.all((day.photos || []).map(src => loadImage(src).catch(() => null)));
  const validImgs = imgs.filter(Boolean);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  drawDayFrame(ctx, width, height, day, validImgs, 3.6, null);
  return canvas.toDataURL("image/jpeg", 0.9);
}

// ----------------------------------------------------------------------------
// Живой плеер сцены дня (Canvas 60fps + синхронный звук + экспорт WebM видео)
// ----------------------------------------------------------------------------
export async function createLiveStagePlayer({ canvas, day, onTimeUpdate, onStateChange }) {
  const W = 720;
  const H = 1280;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const imgs = (await Promise.all((day.photos || []).map(s => loadImage(s).catch(() => null)))).filter(Boolean);
  const durationSec = 24;

  let playing = false;
  let rafId = null;
  let startTimeMs = 0;
  let elapsedSec = 0;

  // Аудиодвижок (воспроизводит прикреплённый трек ИЛИ процедурный аккомпанемент по BPM/ладу)
  let audioEl = null;
  let audioCtx = null;
  let analyser = null;
  let mediaDest = null;
  let freqBuf = null;
  let procTimer = null;

  function ensureAudio() {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    freqBuf = new Uint8Array(analyser.frequencyBinCount);
    mediaDest = audioCtx.createMediaStreamDestination();
    analyser.connect(audioCtx.destination);
    analyser.connect(mediaDest);

    const srcUrl = day.musicAnalysis?.audioDataUrl || day.musicAnalysis?.url;
    const isDirectAudio = srcUrl && (srcUrl.startsWith("data:audio") || srcUrl.startsWith("blob:") || /\.(wav|mp3|ogg)$/i.test(srcUrl));

    if (isDirectAudio) {
      audioEl = new Audio();
      audioEl.crossOrigin = "anonymous";
      audioEl.src = srcUrl;
      audioEl.loop = true;
      const node = audioCtx.createMediaElementSource(audioEl);
      node.connect(analyser);
    }
  }

  function startProceduralSynth() {
    stopProceduralSynth();
    if (!audioCtx) return;
    const bpm = day.passport.rhythm.bpm || 90;
    const isMinor = day.musicAnalysis?.mode === "minor";
    const stepMs = (60 / bpm / 2) * 1000;
    const scale = isMinor ? [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0] : [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 523.25];
    let step = 0;

    procTimer = setInterval(() => {
      if (!playing || !audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = day.passport.techniqueId === "kandinsky" ? "sawtooth" : "sine";
      const freq = scale[(step * 2 + (step % 3)) % scale.length] * (step % 4 === 0 ? 0.5 : 1);
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + stepMs / 1000);
      osc.connect(gain);
      gain.connect(analyser);
      osc.start(now);
      osc.stop(now + stepMs / 1000 + 0.02);
      step++;
    }, stepMs);
  }

  function stopProceduralSynth() {
    if (procTimer) {
      clearInterval(procTimer);
      procTimer = null;
    }
  }

  function sampleAudioLevel() {
    if (!analyser || !freqBuf || !playing) return null;
    analyser.getByteFrequencyData(freqBuf);
    let sum = 0;
    for (let i = 0; i < 40; i++) sum += freqBuf[i];
    return clamp(sum / (40 * 255) * 1.6, 0.1, 1);
  }

  function tick(nowMs) {
    if (!playing) return;
    elapsedSec = (nowMs - startTimeMs) / 1000;
    if (elapsedSec >= durationSec) {
      elapsedSec = elapsedSec % durationSec;
      startTimeMs = nowMs - elapsedSec * 1000;
    }
    const lvl = sampleAudioLevel();
    drawDayFrame(ctx, W, H, day, imgs, elapsedSec, lvl);
    if (onTimeUpdate) onTimeUpdate(elapsedSec, durationSec);
    rafId = requestAnimationFrame(tick);
  }

  // Первичный рендер кадра-обложки
  drawDayFrame(ctx, W, H, day, imgs, 3.6, null);

  async function play() {
    if (playing) return;
    ensureAudio();
    if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();
    if (audioEl) {
      audioEl.currentTime = elapsedSec % (audioEl.duration || 24);
      await audioEl.play().catch(() => {});
    } else {
      startProceduralSynth();
    }
    playing = true;
    startTimeMs = performance.now() - elapsedSec * 1000;
    if (onStateChange) onStateChange(true);
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (audioEl) audioEl.pause();
    stopProceduralSynth();
    if (onStateChange) onStateChange(false);
  }

  function toggle() {
    if (playing) pause();
    else play();
  }

  function seek(norm) {
    elapsedSec = clamp(norm, 0, 0.999) * durationSec;
    startTimeMs = performance.now() - elapsedSec * 1000;
    if (audioEl && audioEl.duration) {
      audioEl.currentTime = elapsedSec % audioEl.duration;
    }
    drawDayFrame(ctx, W, H, day, imgs, elapsedSec, sampleAudioLevel());
    if (onTimeUpdate) onTimeUpdate(elapsedSec, durationSec);
  }

  async function recordVideoWebM(recordDurationSec = 12) {
    ensureAudio();
    if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();
    elapsedSec = 0;
    if (!playing) await play();

    const canvasStream = canvas.captureStream(30);
    const tracks = [...canvasStream.getVideoTracks()];
    if (mediaDest && mediaDest.stream.getAudioTracks().length > 0) {
      tracks.push(...mediaDest.stream.getAudioTracks());
    }
    const combined = new MediaStream(tracks);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const rec = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 3_500_000 });
    const chunks = [];
    rec.ondataavailable = e => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    return new Promise(resolve => {
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        resolve(blob);
      };
      rec.start(200);
      setTimeout(() => {
        if (rec.state !== "inactive") rec.stop();
      }, recordDurationSec * 1000);
    });
  }

  function destroy() {
    pause();
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  }

  return { play, pause, toggle, seek, recordVideoWebM, destroy, isPlaying: () => playing };
}
