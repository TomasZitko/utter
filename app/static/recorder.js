// Nahrávání z mikrofonu rovnou do WAV 16 kHz mono (Web Audio API, bez ffmpeg).
//   const r = new WavRecorder(); await r.start(); r.level() ... const blob = await r.stop();
const TARGET_SR = 16000;

class WavRecorder {
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.buf = new Float32Array(this.analyser.fftSize);
    this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.proc.onaudioprocess = (e) => this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    this.source.connect(this.analyser);
    this.source.connect(this.proc);
    this.proc.connect(this.ctx.destination);
  }

  // hlasitost 0..1 pro animaci vlnky
  level() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let s = 0;
    for (const v of this.buf) s += v * v;
    return Math.min(1, Math.sqrt(s / this.buf.length) * 6);
  }

  async stop() {
    this.proc.disconnect();
    this.source.disconnect();
    this.stream.getTracks().forEach((t) => t.stop());
    const sr = this.ctx.sampleRate;
    await this.ctx.close();
    this.analyser = null;
    const len = this.chunks.reduce((n, c) => n + c.length, 0);
    const all = new Float32Array(len);
    let o = 0;
    for (const c of this.chunks) { all.set(c, o); o += c.length; }
    return encodeWav(downsample(all, sr, TARGET_SR), TARGET_SR);
  }
}

// Plays a recording from a URL and reports its loudness, so the wave moves with the real audio.
class ClipPlayer {
  async play(url, onStart) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const data = await (await fetch(url)).arrayBuffer();
    const audio = await this.ctx.decodeAudioData(data);
    this.src = this.ctx.createBufferSource();
    this.src.buffer = audio;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.buf = new Float32Array(this.analyser.fftSize);
    this.src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.seconds = audio.duration;
    return new Promise((done) => {
      this.src.onended = () => { this.stop(); done(); };
      this.src.start();
      if (onStart) onStart();
    });
  }
  level() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let s = 0;
    for (const v of this.buf) s += v * v;
    return Math.min(1, Math.sqrt(s / this.buf.length) * 6);
  }
  stop() {
    try { this.src.onended = null; this.src.stop(); } catch (e) { /* already stopped */ }
    try { this.ctx.close(); } catch (e) { /* already closed */ }
    this.analyser = null;
  }
}

function downsample(x, from, to) {
  if (from === to) return x;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(x.length / ratio));
  for (let i = 0; i < out.length; i++) {
    // průměr přes okno = jednoduchý dolní filtr proti aliasingu
    const a = Math.floor(i * ratio), b = Math.min(x.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b; j++) s += x[j];
    out[i] = s / Math.max(1, b - a);
  }
  return out;
}

function encodeWav(samples, sr) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([v], { type: "audio/wav" });
}
