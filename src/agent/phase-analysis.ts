// Import format-specific decoders directly rather than the auto-detecting
// `audio-decode` dispatcher — that package dynamically imports every
// supported codec (mp3, flac, opus, aac, wma, ...), and esbuild bundles all
// of them since it can't know at build time which branch ever executes
// (that alone took the bundle from ~1.4MB to ~5.6MB). renderPreFxAudio's
// output format follows Live's "Record File Type" setting (WAV or AIFF per
// the 1.0.0-beta.1 SDK docs), so these two dependency-free decoders cover
// every case without pulling in the full dispatcher.
import decodeWav from '@audio/decode-wav';
import decodeAiff from '@audio/decode-aiff';

/** Sniffs the RIFF/WAVE or FORM/AIFF(-C) magic bytes to pick a decoder. */
function decodeRenderedAudio(buffer: Buffer): ReturnType<typeof decodeWav> {
  const isRiffWave =
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE';
  if (isRiffWave) return decodeWav(buffer);

  const isFormAiff =
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'FORM' &&
    (buffer.toString('ascii', 8, 12) === 'AIFF' || buffer.toString('ascii', 8, 12) === 'AIFC');
  if (isFormAiff) return decodeAiff(buffer);

  throw new Error(
    'Rendered audio is neither WAV nor AIFF — unrecognized format from renderPreFxAudio.',
  );
}

/**
 * Mono-compatibility (stereo phase) analysis for a single track's audio.
 *
 * This only answers "do these two channels cancel when summed to mono" — a
 * correlation number, not a verdict. Wide-stereo effects (choruses, some
 * reverbs, doubled parts panned hard) can legitimately show low or mildly
 * negative correlation without being "broken"; only strongly negative
 * correlation is a reliable red flag. Leave the final judgment to whoever's
 * reading the result.
 */
export interface MonoCompatibilityResult {
  channelCount: number;
  /** Pearson correlation between L and R at zero lag, in [-1, 1]. Null if not stereo. */
  correlation: number | null;
  sampleRate: number;
  durationSeconds: number;
  note: string;
}

/** Pearson correlation between two signals at zero lag (no time-shift search). */
export function correlateChannels(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;

  let sumA = 0;
  let sumB = 0;
  let sumAB = 0;
  let sumA2 = 0;
  let sumB2 = 0;
  for (let i = 0; i < n; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    sumA += av;
    sumB += bv;
    sumAB += av * bv;
    sumA2 += av * av;
    sumB2 += bv * bv;
  }

  const numerator = n * sumAB - sumA * sumB;
  const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function describeCorrelation(correlation: number): string {
  if (correlation < -0.3) {
    return (
      'Strongly negative — likely real phase cancellation when summed to mono. ' +
      'Check for an inverted mic/channel or a timing offset between L and R.'
    );
  }
  if (correlation < 0) {
    return (
      'Mildly negative — some mono-cancellation risk, but this can be intentional ' +
      'wide-stereo content (chorus, doubled/panned parts, some reverbs). Use judgment.'
    );
  }
  if (correlation < 0.7) {
    return 'Positive and not too close to +1 — normal, healthy stereo content.';
  }
  return 'Very close to +1 — channels are nearly identical (effectively mono-like content).';
}

/**
 * Decodes a rendered audio buffer (WAV or AIFF — depends on Live's Record
 * File Type setting) and correlates its left/right channels. Mono input (or
 * a render that collapsed to mono) has no phase to check.
 */
export async function analyzeMonoCompatibility(renderedBuffer: Buffer): Promise<MonoCompatibilityResult> {
  const { channelData, sampleRate } = decodeRenderedAudio(renderedBuffer);
  const channelCount = channelData.length;
  const durationSeconds = channelCount > 0 ? channelData[0]!.length / sampleRate : 0;

  if (channelCount < 2) {
    return {
      channelCount,
      correlation: null,
      sampleRate,
      durationSeconds,
      note: 'Rendered audio is mono — no stereo phase cancellation is possible.',
    };
  }

  const correlation = correlateChannels(channelData[0]!, channelData[1]!);
  return {
    channelCount,
    correlation,
    sampleRate,
    durationSeconds,
    note: describeCorrelation(correlation),
  };
}
