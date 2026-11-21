// ============================================================================
// АТМОСФЕРА // Модуль озвучки текста голосом под атмосферу дня
// ============================================================================

let activeStopFlag = false;
let currentAudio = null;

export function pickRussianVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const ruVoices = voices.filter(v => /ru/i.test(v.lang));
  return (
    ruVoices.find(v => /natural|online|google|irina|dmitry|sasha|pavel/i.test(v.name)) ||
    ruVoices[0] ||
    voices[0] ||
    null
  );
}

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => pickRussianVoice();
}

export function stopVoiceover() {
  activeStopFlag = true;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function isVoiceSpeaking() {
  if (currentAudio && !currentAudio.paused) return true;
  if ("speechSynthesis" in window && window.speechSynthesis.speaking) return true;
  return false;
}

export async function speakDayEntry(day, { onStart, onEnd } = {}) {
  stopVoiceover();
  activeStopFlag = false;

  // Если пользователь записал живой голос для этого дня — воспроизводим его
  if (day.customVoiceDataUrl) {
    currentAudio = new Audio(day.customVoiceDataUrl);
    if (onStart) onStart();
    currentAudio.onended = () => {
      if (onEnd) onEnd();
    };
    await currentAudio.play().catch(() => {
      if (onEnd) onEnd();
    });
    return;
  }

  if (!("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }

  const preset = day.passport?.voicePreset || { rate: 0.92, pitch: 0.95, volume: 0.95, pauseMs: 380 };
  const voice = pickRussianVoice();
  const sentences = (day.text || "")
    .split(/(?<=[.!?…])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (!sentences.length) {
    if (onEnd) onEnd();
    return;
  }

  if (onStart) onStart();

  for (let i = 0; i < sentences.length; i++) {
    if (activeStopFlag) break;
    await speakOneSentence(sentences[i], voice, preset);
    if (activeStopFlag) break;
    if (i < sentences.length - 1) {
      await new Promise(r => setTimeout(r, preset.pauseMs || 350));
    }
  }

  if (onEnd) onEnd();
}

function speakOneSentence(text, voice, preset) {
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ru-RU";
    if (voice) u.voice = voice;
    u.rate = preset.rate || 0.94;
    u.pitch = preset.pitch || 0.96;
    u.volume = preset.volume || 0.95;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// Запись собственного голоса с микрофона (разрешено правилами: «голоса участников команды»)
export async function createMicRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = e => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  rec.start();
  return {
    stop: () =>
      new Promise(resolve => {
        rec.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        };
        rec.stop();
      })
  };
}
