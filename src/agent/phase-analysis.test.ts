import { describe, expect, it } from 'vitest';
import { analyzeMonoCompatibility, correlateChannels } from './phase-analysis.js';

// ─── Synthetic audio encoders ───────────────────────────────────────────────
// analyzeMonoCompatibility() sniffs magic bytes and dispatches to
// @audio/decode-wav or @audio/decode-aiff (see the format-follows-Live's-
// Record-File-Type comment in phase-analysis.ts). These minimal 16-bit PCM
// encoders exercise both real decode paths rather than mocking them, mirroring
// the manual verification described in the commits that introduced this file
// (synthetic identical/inverted/mono buffers) as a durable regression test.

/** Builds a 16-bit PCM WAV buffer (little-endian) from interleaved-ready channel data. */
function buildWav(channels: number[][], sampleRate: number): Buffer {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c]![i]!));
      buf.writeInt16LE(Math.round(sample * 32767), offset);
      offset += 2;
    }
  }
  return buf;
}

/** Writes a sample rate as an 80-bit IEEE 754 extended-precision float (AIFF's COMM chunk format). */
function writeF80(buf: Buffer, offset: number, value: number): void {
  if (value === 0) {
    buf.fill(0, offset, offset + 10);
    return;
  }
  const sign = value < 0 ? 1 : 0;
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log2(abs));
  const mantissa = Math.round((abs / Math.pow(2, exp)) * Math.pow(2, 63));
  const biasedExp = exp + 16383;

  buf.writeUInt8((sign << 7) | (biasedExp >> 8), offset);
  buf.writeUInt8(biasedExp & 0xff, offset + 1);
  buf.writeUInt32BE(Math.floor(mantissa / 4294967296), offset + 2);
  buf.writeUInt32BE(mantissa >>> 0, offset + 6);
}

/** Builds a 16-bit PCM AIFF buffer (big-endian) from interleaved-ready channel data. */
function buildAiff(channels: number[][], sampleRate: number): Buffer {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const ssndDataSize = numFrames * numChannels * bytesPerSample;
  const ssndChunkSize = 8 + ssndDataSize; // offset(4) + blockSize(4) + data
  const commChunkSize = 18;
  const formSize = 4 + (8 + commChunkSize) + (8 + ssndChunkSize);

  const buf = Buffer.alloc(8 + formSize);
  buf.write('FORM', 0, 'ascii');
  buf.writeUInt32BE(formSize, 4);
  buf.write('AIFF', 8, 'ascii');

  let offset = 12;
  buf.write('COMM', offset, 'ascii');
  buf.writeUInt32BE(commChunkSize, offset + 4);
  buf.writeUInt16BE(numChannels, offset + 8);
  buf.writeUInt32BE(numFrames, offset + 10);
  buf.writeUInt16BE(16, offset + 14); // bits per sample
  writeF80(buf, offset + 16, sampleRate);
  offset += 8 + commChunkSize;

  buf.write('SSND', offset, 'ascii');
  buf.writeUInt32BE(ssndChunkSize, offset + 4);
  buf.writeUInt32BE(0, offset + 8); // data offset
  buf.writeUInt32BE(0, offset + 12); // block size
  offset += 16;

  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c]![i]!));
      buf.writeInt16BE(Math.round(sample * 32767), offset);
      offset += 2;
    }
  }
  return buf;
}

/** Deterministic pseudo-random signal in [-1, 1] — no relation between seeds. */
function noise(seed: number, n: number): number[] {
  const out: number[] = [];
  let state = seed;
  for (let i = 0; i < n; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    out.push((state / 0x7fffffff) * 2 - 1);
  }
  return out;
}

function sine(freqHz: number, n: number, sampleRate: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * freqHz * i) / sampleRate));
}

// ─── correlateChannels (pure DSP) ────────────────────────────────────────────

describe('correlateChannels', () => {
  it('returns +1 for identical signals', () => {
    const a = new Float32Array(sine(440, 512, 44100));
    expect(correlateChannels(a, a)).toBeCloseTo(1, 5);
  });

  it('returns -1 for inverted signals', () => {
    const a = new Float32Array(sine(440, 512, 44100));
    const b = new Float32Array(a.map((v) => -v));
    expect(correlateChannels(a, b)).toBeCloseTo(-1, 5);
  });

  it('returns ~0 for uncorrelated noise', () => {
    const a = new Float32Array(noise(1, 4096));
    const b = new Float32Array(noise(999, 4096));
    expect(Math.abs(correlateChannels(a, b))).toBeLessThan(0.1);
  });

  it('returns 0 for empty input', () => {
    expect(correlateChannels(new Float32Array(0), new Float32Array(0))).toBe(0);
  });
});

// ─── analyzeMonoCompatibility (format sniff + decode + correlate) ───────────

describe('analyzeMonoCompatibility', () => {
  const sampleRate = 44100;
  const n = 2048;

  it('decodes WAV and reports strong positive correlation for identical channels', async () => {
    const tone = sine(440, n, sampleRate);
    const buf = buildWav([tone, tone], sampleRate);
    const result = await analyzeMonoCompatibility(buf);
    expect(result.channelCount).toBe(2);
    expect(result.correlation).toBeCloseTo(1, 2);
    expect(result.note).toMatch(/nearly identical/i);
  });

  it('decodes WAV and reports strong negative correlation for inverted channels', async () => {
    const tone = sine(440, n, sampleRate);
    const inverted = tone.map((v) => -v);
    const buf = buildWav([tone, inverted], sampleRate);
    const result = await analyzeMonoCompatibility(buf);
    expect(result.correlation).toBeCloseTo(-1, 2);
    expect(result.note).toMatch(/phase cancellation/i);
  });

  it('reports null correlation for mono WAV input', async () => {
    const tone = sine(440, n, sampleRate);
    const buf = buildWav([tone], sampleRate);
    const result = await analyzeMonoCompatibility(buf);
    expect(result.channelCount).toBe(1);
    expect(result.correlation).toBeNull();
    expect(result.note).toMatch(/mono/i);
  });

  it('decodes AIFF and reports strong positive correlation for identical channels', async () => {
    const tone = sine(440, n, sampleRate);
    const buf = buildAiff([tone, tone], sampleRate);
    const result = await analyzeMonoCompatibility(buf);
    expect(result.channelCount).toBe(2);
    expect(result.sampleRate).toBeCloseTo(sampleRate, 0);
    expect(result.correlation).toBeCloseTo(1, 2);
  });

  it('decodes AIFF and reports strong negative correlation for inverted channels', async () => {
    const tone = sine(440, n, sampleRate);
    const inverted = tone.map((v) => -v);
    const buf = buildAiff([tone, inverted], sampleRate);
    const result = await analyzeMonoCompatibility(buf);
    expect(result.correlation).toBeCloseTo(-1, 2);
  });

  it('rejects a buffer that is neither WAV nor AIFF', async () => {
    const garbage = Buffer.from('not an audio file at all, just text');
    await expect(analyzeMonoCompatibility(garbage)).rejects.toThrow(/neither WAV nor AIFF/);
  });
});
