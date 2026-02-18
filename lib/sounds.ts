import { Audio } from "expo-av";

type ToneSegment = { frequency: number; durationMs: number; volume?: number };

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function generateWav(segments: ToneSegment[], sampleRate = 22050): Uint8Array {
  let totalSamples = 0;
  for (const seg of segments) {
    totalSamples += Math.floor((sampleRate * seg.durationMs) / 1000);
  }

  const dataSize = totalSamples * 2;
  const buffer = new Uint8Array(44 + dataSize);
  const view = new DataView(buffer.buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const seg of segments) {
    const numSamples = Math.floor((sampleRate * seg.durationMs) / 1000);
    const vol = seg.volume ?? 0.5;
    const fadeLen = Math.min(Math.floor(sampleRate * 0.005), Math.floor(numSamples / 4));

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let envelope = 1;
      if (i < fadeLen) envelope = i / fadeLen;
      if (i > numSamples - fadeLen) envelope = (numSamples - i) / fadeLen;

      const sample =
        seg.frequency > 0 ? Math.sin(2 * Math.PI * seg.frequency * t) * vol * envelope : 0;
      const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return buffer;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += BASE64[(b0 >> 2) & 0x3f];
    result += BASE64[((b0 << 4) | (b1 >> 4)) & 0x3f];
    result += i + 1 < bytes.length ? BASE64[((b1 << 2) | (b2 >> 6)) & 0x3f] : "=";
    result += i + 2 < bytes.length ? BASE64[b2 & 0x3f] : "=";
  }
  return result;
}

function wavToDataUri(segments: ToneSegment[]): string {
  const wav = generateWav(segments);
  const b64 = uint8ArrayToBase64(wav);
  return `data:audio/wav;base64,${b64}`;
}

const SOUND_DEFS: Record<string, ToneSegment[]> = {
  countdown3: [{ frequency: 800, durationMs: 120, volume: 0.4 }],
  countdown2: [{ frequency: 1000, durationMs: 120, volume: 0.5 }],
  countdown1: [{ frequency: 1200, durationMs: 150, volume: 0.6 }],
  go: [
    { frequency: 880, durationMs: 120, volume: 0.45 },
    { frequency: 0, durationMs: 25 },
    { frequency: 988, durationMs: 120, volume: 0.5 },
    { frequency: 0, durationMs: 25 },
    { frequency: 1175, durationMs: 220, volume: 0.62 },
  ],
  workTick: [{ frequency: 600, durationMs: 80, volume: 0.3 }],
  complete: [
    { frequency: 523, durationMs: 130, volume: 0.5 },
    { frequency: 0, durationMs: 30 },
    { frequency: 659, durationMs: 130, volume: 0.5 },
    { frequency: 0, durationMs: 30 },
    { frequency: 784, durationMs: 280, volume: 0.6 },
  ],
};

class SoundManager {
  private sounds = new Map<string, Audio.Sound>();
  private initPromise: Promise<void> | null = null;

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init() {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      console.log("[SoundManager] audio mode set");
    } catch (e) {
      console.warn("[SoundManager] audio mode failed:", e);
    }

    const results = await Promise.allSettled(
      Object.entries(SOUND_DEFS).map(async ([name, segments]) => {
        const uri = wavToDataUri(segments);
        console.log(`[SoundManager] loading ${name}, uri length=${uri.length}`);
        const { sound } = await Audio.Sound.createAsync({ uri });
        this.sounds.set(name, sound);
        console.log(`[SoundManager] loaded: ${name}`);
      }),
    );
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length)
      console.warn(
        "[SoundManager] failures:",
        failed.map((r) => (r as PromiseRejectedResult).reason),
      );
    console.log(`[SoundManager] init done, ${this.sounds.size} sounds loaded`);
  }

  async play(name: string) {
    const sound = this.sounds.get(name);
    if (!sound) {
      console.warn(
        `[SoundManager] play "${name}" — not loaded (have: ${[...this.sounds.keys()].join(", ")})`,
      );
      return;
    }
    try {
      await sound.setPositionAsync(0);
      await sound.playAsync();
      console.log(`[SoundManager] playing: ${name}`);
    } catch (e) {
      console.warn(`[SoundManager] play "${name}" error:`, e);
    }
  }

  async cleanup() {
    for (const sound of this.sounds.values()) {
      try {
        await sound.unloadAsync();
      } catch {
        /* ignore */
      }
    }
    this.sounds.clear();
    this.initPromise = null;
  }
}

export const soundManager = new SoundManager();
