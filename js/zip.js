// ============================================================================
// АТМОСФЕРА // Упаковщик «Папки дня» (.zip и прямая запись папки на диск)
// ============================================================================

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Сборка стандартного ZIP-архива (метод STORE + флаг UTF-8 для кириллических имён папок)
export function buildZipBlob(entries) {
  const enc = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.path);
    const data = entry.data instanceof Uint8Array ? entry.data : enc.encode(String(entry.data));
    const crc = crc32(data);

    // Local file header (30 bytes + name)
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true);      // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    localChunks.push(lh, data);

    // Central directory header (46 bytes + name)
    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); // UTF-8
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);

    centralChunks.push(ch);
    offset += lh.length + data.length;
  }

  const centralSize = centralChunks.reduce((acc, c) => acc + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localChunks, ...centralChunks, eocd], { type: "application/zip" });
}

async function fetchAsBytes(urlOrDataUrl) {
  const res = await fetch(urlOrDataUrl);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

// Собирает полное содержимое «Папки дня»: текст, фото, песню, готовое воспоминание и озвучку
export async function collectDayFolderFiles(day, videoBlob = null) {
  const safeFolder = (day.folderTitle || "Папка дня").replace(/[\\/:*?"<>|]/g, "");
  const files = [];

  // 1. Текст записи и сводка дня
  const noteTxt = [
    `АТМОСФЕРА // ПАПКА ДНЯ: «${day.folderTitle}»`,
    `Дата: ${day.date || "2026-11-21"}`,
    `Место: ${day.textAnalysis?.place || day.location || "—"}`,
    `Погода: ${day.weather || "—"}`,
    `Художественный приём: ${day.passport?.technique?.name} (${day.passport?.technique?.reference})`,
    `Песня дня: ${day.musicAnalysis?.artist} — ${day.musicAnalysis?.title} (${day.musicAnalysis?.bpm} BPM, ${day.musicAnalysis?.keySignature})`,
    `Голос озвучки: ${day.passport?.voicePreset?.name} (скорость ${day.passport?.voicePreset?.rate}x, тон ${day.passport?.voicePreset?.pitch})`,
    ``,
    `--- ТЕКСТ ЗАПИСИ ---`,
    day.text || "",
    ``,
    `--- ОБЪЯСНИМАЯ ЛОГИКА ВИЗУАЛЬНОЙ СИСТЕМЫ ---`,
    ...(day.passport?.explanations || []).map(e => `[${e.source}] ${e.text}`)
  ].join("\r\n");

  files.push({
    relPath: "note.txt",
    path: `${safeFolder}/note.txt`,
    data: noteTxt
  });

  // 2. Готовое воспоминание (постер высокого разрешения)
  if (day.posterDataUrl) {
    try {
      const posterBytes = await fetchAsBytes(day.posterDataUrl);
      files.push({
        relPath: "memory_poster.jpg",
        path: `${safeFolder}/memory_poster.jpg`,
        data: posterBytes
      });
    } catch (_) {}
  }

  // 3. Видео-воспоминание (если записано)
  if (videoBlob) {
    const vBytes = new Uint8Array(await videoBlob.arrayBuffer());
    files.push({
      relPath: "memory_video.webm",
      path: `${safeFolder}/memory_video.webm`,
      data: vBytes
    });
  }

  // 4. Исходные фотографии дня
  const photos = day.photos || [];
  for (let i = 0; i < photos.length; i++) {
    try {
      const pBytes = await fetchAsBytes(photos[i]);
      files.push({
        relPath: `photos/photo_${i + 1}.jpg`,
        path: `${safeFolder}/photos/photo_${i + 1}.jpg`,
        data: pBytes
      });
    } catch (_) {}
  }

  // 5. Песня (CC0/свой аудиофайл ИЛИ метаданные и ссылка на музыкальный сервис)
  const musicSrc = day.musicAnalysis?.audioDataUrl || day.musicAnalysis?.url || "";
  if (musicSrc && (musicSrc.startsWith("data:audio") || /\.(wav|mp3|ogg)$/i.test(musicSrc))) {
    try {
      const ext = (musicSrc.match(/\.(wav|mp3|ogg)$/i) || [null, "wav"])[1];
      const mBytes = await fetchAsBytes(musicSrc);
      files.push({
        relPath: `music/track.${ext}`,
        path: `${safeFolder}/music/track.${ext}`,
        data: mBytes
      });
    } catch (_) {}
  }
  files.push({
    relPath: "music/music_analysis.json",
    path: `${safeFolder}/music/music_analysis.json`,
    data: JSON.stringify(
      {
        title: day.musicAnalysis?.title,
        artist: day.musicAnalysis?.artist,
        genre: day.musicAnalysis?.genre,
        year: day.musicAnalysis?.year,
        streamingUrl: day.musicAnalysis?.url,
        bpm: day.musicAnalysis?.bpm,
        keySignature: day.musicAnalysis?.keySignature,
        mode: day.musicAnalysis?.mode,
        energy: day.musicAnalysis?.energy,
        brightness: day.musicAnalysis?.brightness
      },
      null,
      2
    )
  });

  // 6. Озвучка (параметры голоса + аудиозапись голоса, если есть)
  if (day.customVoiceDataUrl) {
    try {
      const vBytes = await fetchAsBytes(day.customVoiceDataUrl);
      files.push({
        relPath: "voiceover/voice_recording.webm",
        path: `${safeFolder}/voiceover/voice_recording.webm`,
        data: vBytes
      });
    } catch (_) {}
  }
  files.push({
    relPath: "voiceover/voice_preset.json",
    path: `${safeFolder}/voiceover/voice_preset.json`,
    data: JSON.stringify(day.passport?.voicePreset || {}, null, 2)
  });

  // 7. Паспорт визуальной системы
  files.push({
    relPath: "visual_passport.json",
    path: `${safeFolder}/visual_passport.json`,
    data: JSON.stringify(day.passport || {}, null, 2)
  });

  return { safeFolder, files };
}

export async function downloadDayFolderZip(day, videoBlob = null) {
  const { safeFolder, files } = await collectDayFolderFiles(day, videoBlob);
  const blob = buildZipBlob(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFolder}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Прямое сохранение реальной папки на диск через File System Access API (Chrome / Edge)
export async function saveDayFolderToDisk(day, videoBlob = null) {
  if (!("showDirectoryPicker" in window)) {
    await downloadDayFolderZip(day, videoBlob);
    return { mode: "zip" };
  }
  const rootHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  const { safeFolder, files } = await collectDayFolderFiles(day, videoBlob);
  const dayDir = await rootHandle.getDirectoryHandle(safeFolder, { create: true });

  for (const f of files) {
    const parts = f.relPath.split("/");
    let dir = dayDir;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: true });
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(f.data);
    await writable.close();
  }
  return { mode: "directory", folderName: safeFolder };
}
