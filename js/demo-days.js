// ============================================================================
// АТМОСФЕРА // 7 демонстрационных дней с разным настроением («Проверка лентой»)
// ============================================================================

import { analyzeText, analyzePhotos } from "./analyze.js";
import { buildVisualPassport } from "./visual-system.js";
import { renderPosterDataUrl } from "./renderer.js";

export const DEMO_SEEDS = [
  {
    id: "day-1-autumn-park",
    seq: 1,
    date: "2026-10-18",
    location: "Старый ботанический парк",
    weather: "+6°C, шуршат листья",
    text: "Гуляли по парку, всё в жёлтых листьях, было холодно, но мы пили горячее какао в бумажных стаканчиках и долго разговаривали у пруда. Перчатки пахли дымом и корицей, утки плыли по золотой воде, и совсем не хотелось спешить домой.",
    photos: ["demo/photos/d1_1.jpg", "demo/photos/d1_2.jpg", "demo/photos/d1_3.jpg"],
    music: {
      title: "Autumn Waltz in F (Original CC0 Session)",
      artist: "Sinatra Tribute Trio",
      genre: "vocal jazz / traditional pop",
      year: "1957 / CC0",
      url: "demo/audio/day1_autumn_waltz.wav",
      bpm: 84,
      mode: "major",
      keySignature: "F мажор",
      energy: 0.38,
      brightness: 0.36
    }
  },
  {
    id: "day-2-office-deadline",
    seq: 2,
    date: "2026-11-19",
    location: "Офис, 14 этаж",
    weather: "+1°C, ночной ветер",
    text: "Срочная сдача проекта, три часа ночи в пустом офисе. На столе остывший эспрессо, в наушниках плотная электронная музыка, за панорамным стеклом холодные огни проспекта. Пальцы стучат по клавиатуре, сборка наконец проходит без ошибок!",
    photos: ["demo/photos/d2_1.jpg", "demo/photos/d2_2.jpg", "demo/photos/d2_3.jpg"],
    music: {
      title: "Night Compile 128",
      artist: "Kandinsky Pulse",
      genre: "electronic / minimal techno",
      year: "2026",
      url: "demo/audio/day2_night_deadline.wav",
      bpm: 128,
      mode: "minor",
      keySignature: "A минор",
      energy: 0.86,
      brightness: 0.78
    }
  },
  {
    id: "day-3-summer-sea",
    seq: 3,
    date: "2026-07-24",
    location: "Дикий пляж у мыса",
    weather: "+29°C, яркое солнце",
    text: "Прыгали в бирюзовые волны до головокружения, смеялись с друзьями на весь берег и ели ледяной сладкий арбуз прямо на полосатом полотенце. Соль на плечах, солнце слепит глаза, самое беззаботное лето!",
    photos: ["demo/photos/d3_1.jpg", "demo/photos/d3_2.jpg", "demo/photos/d3_3.jpg"],
    music: {
      title: "Turquoise Coastline",
      artist: "Sun Cutouts",
      genre: "sunshine pop / funk",
      year: "2026",
      url: "demo/audio/day3_summer_sea.wav",
      bpm: 120,
      mode: "major",
      keySignature: "D мажор",
      energy: 0.82,
      brightness: 0.74
    }
  },
  {
    id: "day-4-rain-window",
    seq: 4,
    date: "2026-10-29",
    location: "Дома у подоконника",
    weather: "+7°C, затяжной дождь",
    text: "Весь день за окном шёл мелкий серый дождь, капли медленно сползали по стеклу. Сидел один на подоконнике с чашкой зелёного чая и бумажной книгой, смотрел на редкие зонты внизу и слушал тихое пианино...",
    photos: ["demo/photos/d4_1.jpg", "demo/photos/d4_2.jpg", "demo/photos/d4_3.jpg"],
    music: {
      title: "Raindrops on Glass",
      artist: "Ma Ensemble",
      genre: "neoclassical / ambient piano",
      year: "2026",
      url: "demo/audio/day4_rain_piano.wav",
      bpm: 62,
      mode: "minor",
      keySignature: "E минор",
      energy: 0.24,
      brightness: 0.28
    }
  },
  {
    id: "day-5-first-snow",
    seq: 5,
    date: "2026-11-15",
    location: "Старый двор с фонарём",
    weather: "-3°C, первый снегопад",
    text: "Вышел вечером во двор — а там тихо падает первый снег. В жёлтом луче старого фонаря кружатся крупные снежинки, на красной вязаной варежке не тают кристаллы, и свежие следы ведут к тёплому подъезду, совсем как в детстве.",
    photos: ["demo/photos/d5_1.jpg", "demo/photos/d5_2.jpg", "demo/photos/d5_3.jpg"],
    music: {
      title: "Courtyard Streetlamp 1986",
      artist: "Polaroid Tape",
      genre: "retro synth / nostalgic wave",
      year: "1986 / CC0",
      url: "demo/audio/day5_first_snow_retro.wav",
      bpm: 92,
      mode: "major",
      keySignature: "C мажор",
      energy: 0.44,
      brightness: 0.42
    }
  },
  {
    id: "day-6-mountain-dawn",
    seq: 6,
    date: "2026-08-19",
    location: "Перевал, 3100 м",
    weather: "+4°C, чистый горный воздух",
    text: "Вышли из палатки ещё в темноте и поднялись на хребет к самому рассвету. Под ногами целое море белых облаков, а вершины вспыхнули розовым и золотым светом. Стоишь на ветру, дышишь полной грудью — и внутри абсолютная свобода.",
    photos: ["demo/photos/d6_1.jpg", "demo/photos/d6_2.jpg", "demo/photos/d6_3.jpg"],
    music: {
      title: "Above the Sea of Clouds",
      artist: "Horizon Light",
      genre: "cinematic / post-rock",
      year: "2026",
      url: "demo/audio/day6_mountain_dawn.wav",
      bpm: 100,
      mode: "major",
      keySignature: "G мажор",
      energy: 0.66,
      brightness: 0.64
    }
  },
  {
    id: "day-7-birthday-party",
    seq: 7,
    date: "2026-11-08",
    location: "Гостиная, полный дом гостей",
    weather: "Тёплый свет свечей",
    text: "В комнате погасили свет и внесли торт со свечами! Конфетти в воздухе, звон бокалов, все друзья кричат поздравления, обнимаются и танцуют прямо между стульями. Шумный, тёплый и безумно счастливый день рождения!",
    photos: ["demo/photos/d7_1.jpg", "demo/photos/d7_2.jpg", "demo/photos/d7_3.jpg"],
    music: {
      title: "Candles & Confetti 124",
      artist: "Midnight Brass",
      genre: "festive dance / indie pop",
      year: "2026",
      url: "demo/audio/day7_birthday_dance.wav",
      bpm: 124,
      mode: "major",
      keySignature: "B♭ мажор",
      energy: 0.9,
      brightness: 0.8
    }
  }
];

export async function buildDayObjectFromSeed(seed) {
  const textAnalysis = analyzeText(seed.text, {
    date: seed.date,
    location: seed.location,
    weather: seed.weather
  });
  const photoAnalysis = await analyzePhotos(seed.photos);
  const waveform = Array.from({ length: 32 }, (_, i) => {
    const phase = (i / 32) * Math.PI * 2;
    const v = seed.music.energy * (0.65 + 0.35 * Math.sin(phase * (seed.music.bpm / 28) + i * 0.6));
    return Number(Math.max(0.12, Math.min(0.98, v)).toFixed(2));
  });
  const musicAnalysis = {
    sourceType: "file",
    ...seed.music,
    waveform
  };
  const passport = buildVisualPassport({
    textAnalysis,
    photoAnalysis,
    musicAnalysis
  });

  const day = {
    id: seed.id,
    seq: seed.seq,
    date: seed.date,
    location: seed.location,
    weather: seed.weather,
    text: seed.text,
    folderTitle: textAnalysis.folderTitle,
    photos: seed.photos,
    textAnalysis,
    photoAnalysis,
    musicAnalysis,
    passport
  };

  day.posterDataUrl = await renderPosterDataUrl(day);
  return day;
}
