// SSR-Safe Studio Audio Clips (Base64) & Habit Micro-interactions Synthesizer

const isServer = typeof window === "undefined";

const checkSoundEnabled = (): boolean => {
  if (isServer) return false;
  try {
    const saved = localStorage.getItem("cadence-storage");
    if (saved) {
      const parsed = JSON.parse(saved);
      const settings = parsed?.state?.settings || parsed?.state;
      if (settings) {
        if (
          settings.soundEnabled === false ||
          settings.isSoundEnabled === false ||
          settings.isMuted === true ||
          settings.muted === true
        ) {
          return false;
        }
      }
    }
    if (
      localStorage.getItem("soundEnabled") === "false" ||
      localStorage.getItem("isSoundEnabled") === "false" ||
      localStorage.getItem("isMuted") === "true" ||
      localStorage.getItem("muted") === "true" ||
      localStorage.getItem("cadence_sound_enabled") === "false"
    ) {
      return false;
    }
  } catch (e) {}
  return true;
};

// 1. Crisp Soft Mechanical Click (For general buttons & nav links)
const CLICK_SRC =
  "data:audio/wav;base64,UklGRi4AAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAAAAAAA//8BAP//AAD//wAA//8CAP//AAAAAP//AQAAAAEAAAD//wIA//8AAP//AQABAAIAAAA=";

const playAudio = (src: string, volume = 0.15) => {
  if (!checkSoundEnabled()) return;
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch (e) {}
};

export const playSound = (srcOrName?: string, volume = 0.15) => {
  if (!checkSoundEnabled()) return;
  if (srcOrName && srcOrName.startsWith("data:audio")) {
    playAudio(srcOrName, volume);
  } else {
    playClickSound();
  }
};

export const playClickSound = () => {
  if (!checkSoundEnabled()) return;
  playAudio(CLICK_SRC, 0.12);
};

// 2. Distinct Toggle Sound (Pitch Slide for Sidebar Open/Close)
export const playToggleSound = (isOpen: boolean) => {
  if (!checkSoundEnabled()) return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    const start = isOpen ? 300 : 700;
    const end = isOpen ? 700 : 300;
    osc.frequency.setValueAtTime(start, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(end, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {}
};

// 3. Dopamine Success Chime (2 Harmonic Tones for Habit Completion - legacy compatibility)
export const playSuccessSound = () => {
  if (!checkSoundEnabled()) return;
  playCompleteHabitSound();
};

const getContext = () => {
  if (!checkSoundEnabled()) return null;
  if (isServer) return null;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    return AudioContext ? new AudioContext() : null;
  } catch (e) {
    return null;
  }
};

// 1. ADD HABIT SOUND (Upward Inspiring Chime)
export const playAddHabitSound = () => {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.1);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch (e) {}
};

// 2. COMPLETE HABIT SOUND (Dopamine Success Double-Tone)
export const playCompleteHabitSound = () => {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Tone 1
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now); // C5
    g1.gain.setValueAtTime(0.12, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc1.connect(g1);
    g1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.08);

    // Tone 2 (Higher)
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.06); // E5
    g2.gain.setValueAtTime(0.12, now + 0.06);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.16);
  } catch (e) {}
};

// 3. UNCHECK HABIT SOUND (Soft Undo Tap)
export const playUncheckHabitSound = () => {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  } catch (e) {}
};

// 4. DELETE HABIT SOUND (Soft Low Thud)
export const playDeleteHabitSound = () => {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
};

// 5. FAILURE / RESET SOUND (Descending Tone for Quit Habits Timer Reset / Relapse)
export const playFailureSound = () => {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.18);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  } catch (e) {}
};

// SSR-Safe Freeze Habit Sound (Soft, smooth, elegant crystalline glass chime)
export const playFreezeSound = () => {
  if (!checkSoundEnabled()) return;
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch (e) {}
};
