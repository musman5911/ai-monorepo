// muf shared helper — short voice notes (MediaRecorder → base64 data-URL).
// TWIN FILE: dairy_farm/client/src/muf-voice.ts and flock_farm/client/src/muf-voice.ts
// must stay IDENTICAL. Run `node check-muf-sync.js` from the repo root after editing.

export const MAX_VOICE_SECONDS = 60;

export function isVoiceSupported(): boolean {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function'
    && typeof (window as any).MediaRecorder !== 'undefined';
}

export interface VoiceRecorder {
  /** Stops recording and resolves to a playable audio data-URL. */
  stop: () => Promise<string>;
  /** Aborts recording and releases the microphone. */
  cancel: () => void;
}

/** Asks for the microphone and starts recording (auto-stops at MAX_VOICE_SECONDS). */
export async function startVoiceRecording(onAutoStop?: () => void): Promise<VoiceRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = (window as any).MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
  const recorder = new (window as any).MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e: any) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.start();

  let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    if (recorder.state === 'recording') {
      recorder.stop();
      if (onAutoStop) onAutoStop();
    }
  }, MAX_VOICE_SECONDS * 1000);

  const cleanup = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    stop: () => new Promise<string>((resolve, reject) => {
      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunks, { type: mime || 'audio/webm' });
        const r = new FileReader();
        r.onerror = () => reject(new Error('Could not read the recording'));
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(blob);
      };
      if (recorder.state === 'recording') recorder.stop();
      else recorder.onstop(null as any);
    }),
    cancel: () => {
      try { if (recorder.state === 'recording') recorder.stop(); } catch { /* ignore */ }
      cleanup();
    },
  };
}
