// Sound, synthesised live with WebAudio — no audio files, no network.
// Every effect is a short oscillator/filter envelope; the music is a quiet
// two-bar bass-and-pad loop that starts on the first player interaction.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noise(duration, volume, lowpass) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  const BASS = [55, 55, 65.41, 49];
  const PAD = [220, 261.63, 329.63, 392];

  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const step = musicStep % 8;
      if (step % 2 === 0) tone(BASS[(musicStep / 2) % 4 | 0], 0.5, 'triangle', 0.10);
      if (step === 0) tone(PAD[musicStep % 4], 1.8, 'sine', 0.045);
      musicStep += 1;
    }, 240);
  }

  return {
    unlock() { ensure(); startMusic(); },
    shoot() { tone(880, 0.09, 'square', 0.05, 320); },
    hit() { noise(0.12, 0.14, 2400); tone(180, 0.1, 'sawtooth', 0.06, 60); },
    explode() { noise(0.35, 0.22, 1200); tone(90, 0.3, 'sawtooth', 0.10, 30); },
    pickup() { tone(660, 0.08, 'sine', 0.08, 990); },
    powerup() { tone(523, 0.1, 'sine', 0.09, 784); tone(784, 0.14, 'sine', 0.07, 1046); },
    hurt() { tone(220, 0.25, 'sawtooth', 0.12, 55); noise(0.2, 0.12, 900); },
    dash() { noise(0.14, 0.08, 3200); },
    wave() { tone(392, 0.12, 'triangle', 0.09, 587); tone(587, 0.18, 'triangle', 0.08, 784); },
    boss() { tone(110, 0.5, 'sawtooth', 0.12, 55); tone(165, 0.5, 'sawtooth', 0.08, 82); },
    win() { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 130)); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  };
}
