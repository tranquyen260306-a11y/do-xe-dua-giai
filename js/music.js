// Nhạc nền tạo bằng Web Audio, không cần file nhạc nên không vướng bản quyền.
// Nhạc gồm trống, bass, hợp âm nền và giai điệu, lặp lại vòng hợp âm Am - F - C - G (4 ô nhịp).
// Mỗi kiểu nhạc (STYLES) là một bộ nhịp điệu khác nhau trên cùng vòng hợp âm.

const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Vòng hợp âm: nốt gốc (số MIDI) và các quãng của hợp âm
const CHORDS = [
  { root: 45, tones: [0, 3, 7] }, // La thứ
  { root: 41, tones: [0, 4, 7] }, // Fa trưởng
  { root: 48, tones: [0, 4, 7] }, // Đô trưởng
  { root: 43, tones: [0, 4, 7] }, // Sol trưởng
];

// Mỗi ô nhịp chia 16 bước. Các mảng liệt kê những bước có tiếng.
// bass: { bước: số nửa cung cộng thêm vào nốt gốc }. lead: kiểu giai điệu.
const STYLES = {
  // Gara: chậm, nhẹ nhàng
  menu: {
    bpm: 96, kick: [0, 10], snare: [8], hat: [4, 12], hatGain: 0.05,
    bass: { 0: 0, 6: 0, 10: 7, 14: 12 }, pad: 0.05, lead: 'melody',
  },
  // Đang đua: nhanh, dồn dập
  race: {
    bpm: 132, kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], hatGain: 0.08, ride: true,
    bass: { 0: 0, 2: 12, 4: 0, 6: 12, 8: 0, 10: 12, 12: 7, 14: 12 }, pad: 0.035, lead: 'arp',
  },
  // Bục vinh danh: vui, rộn ràng
  win: {
    bpm: 118, kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14], hatGain: 0.06,
    bass: { 0: 0, 3: 0, 6: 7, 8: 12, 11: 7, 14: 0 }, pad: 0.05, lead: 'melody',
  },
};
// Giai điệu kiểu 'melody': mỗi ô nhịp 4 nốt, số là vị trí trong hợp âm (0, 1, 2 = ba nốt, 3 = nốt gốc lên một quãng tám)
const MELODY = [[2, 1, 0, 1], [3, 2, 1, 2], [2, 3, 2, 1], [1, 2, 3, 2]];

export class Music {
  // tracks: danh sách file nhạc cho từng màn, ví dụ { menu: ['a.mp3'], race: ['b.mp3', 'c.mp3'], win: [] }.
  // Màn nào có file thì phát file (hết bài chuyển bài kế), màn nào để trống thì phát nhạc tự tạo.
  constructor(tracks = {}) {
    this.on = true;
    this.vol = 0.5;
    this.style = 'menu';
    this.ctx = null;
    this.timer = null;
    this.ducked = false;
    this.tracks = tracks;
    this.trackIdx = {};
    this.el = null;      // trình phát file nhạc
    this.fileStyle = ''; // màn đang phát file, rỗng = đang phát nhạc tự tạo
    this.onTrack = null; // gọi khi đổi bài, để giao diện hiện tên bài
  }

  // ---------- Phát file nhạc người làm game tự chọn ----------
  // Chọn bài cho màn hiện tại. next = true thì chuyển sang bài kế tiếp trong danh sách.
  playFile(next) {
    const list = this.tracks[this.style] || [];
    if (!list.length || !this.on) {
      if (this.el) this.el.pause();
      this.fileStyle = '';
      if (this.onTrack) this.onTrack('');
      return;
    }
    if (this.fileStyle === this.style && !next) { this.el.play().catch(() => {}); return; }
    if (!this.el) {
      this.el = new Audio();
      // Cho file nhạc đi qua cùng nút âm lượng với nhạc tự tạo
      this.ctx.createMediaElementSource(this.el).connect(this.master);
      this.el.addEventListener('ended', () => this.playFile(true));
      // File hỏng hoặc sai tên: bỏ qua, quay về nhạc tự tạo
      this.el.addEventListener('error', () => { this.fileStyle = ''; if (this.onTrack) this.onTrack(''); });
    }
    const i = this.trackIdx[this.style] = ((this.trackIdx[this.style] ?? -1) + (next || this.fileStyle !== this.style ? 1 : 0)) % list.length;
    this.fileStyle = this.style;
    this.el.src = 'assets/music/' + encodeURIComponent(list[i]);
    this.el.loop = list.length === 1;
    this.el.play().catch(() => {});
    if (this.onTrack) this.onTrack(list[i].replace(/\.[^.]+$/, ''));
  }

  // Nút "bài kế": chỉ có tác dụng khi màn này có từ hai bài trở lên
  nextTrack() { if (this.ctx && this.on) this.playFile(true); }

  // Tạo bộ phát âm thanh. Trình duyệt chỉ cho phát tiếng sau khi người chơi bấm hoặc gõ phím lần đầu.
  init() {
    if (this.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    } catch { return false; }
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    // Hiệu ứng âm thanh (tiếng độ xe, xịt sơn) đi đường riêng, vẫn kêu khi tắt nhạc
    this.fx = this.ctx.createGain();
    this.fx.gain.value = 0.6;
    this.fx.connect(this.ctx.destination);
    // Âm thanh nhiễu trắng, dùng làm tiếng trống snare, hi-hat, tiếng tách, tiếng xì
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Tạm ngưng âm thanh khi chuyển sang cửa sổ khác, để quay lại không bị dồn nốt
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
    return true;
  }

  // Bắt đầu phát nhạc; gọi lúc người chơi bấm hoặc gõ phím lần đầu
  start() {
    if (!this.on || !this.init()) return;
    try {
      this.ctx.resume();
      if (!this.timer) {
        this.step = 0;
        this.next = this.ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 25);
      }
      this.applyVolume(); // đặt sau khi nhạc đã chạy, nếu không âm lượng sẽ bị tính là 0
      this.playFile(false);
    } catch { /* trình duyệt không cho phát tiếng: chơi không có nhạc */ }
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.el) this.el.pause();
    this.applyVolume();
  }

  toggle() {
    this.on = !this.on;
    if (this.on) this.start(); else this.stop();
    return this.on;
  }

  setVolume(v) { this.vol = v; this.applyVolume(); }
  // Vặn nhỏ nhạc khi đang tạm dừng
  duck(on) { this.ducked = on; this.applyVolume(); }
  // Đổi nhạc theo màn. Nhạc tự tạo đổi ở đầu ô nhịp kế tiếp cho khỏi lệch nhịp; file nhạc đổi ngay.
  setStyle(s) {
    if (!STYLES[s]) return;
    this.pendingStyle = s;
    this.style = s;
    if (this.ctx && this.timer) this.playFile(false);
  }

  applyVolume() {
    if (!this.master) return;
    const v = this.on && this.timer ? this.vol * 0.32 * (this.ducked ? 0.35 : 1) : 0;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08);
  }

  // Xếp lịch trước các nốt sắp tới (khoảng 0,12 giây) để nhạc đều, không phụ thuộc tốc độ khung hình
  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    while (this.next < this.ctx.currentTime + 0.12) {
      if (this.step % 16 === 0 && this.pendingStyle) { this.genStyle = this.pendingStyle; this.pendingStyle = null; }
      const st = STYLES[this.genStyle || 'menu'];
      // Đang phát file nhạc thì nhạc tự tạo im, nhưng vẫn giữ nhịp để chuyển qua lại không bị lệch
      if (!this.fileStyle) this.playStep(this.step, this.next, st, 60 / st.bpm / 4);
      this.next += 60 / st.bpm / 4;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(i, t, st, sixteenth) {
    const bar = i >> 4, s = i & 15, chord = CHORDS[bar];
    if (st.kick.includes(s)) this.kick(t);
    if (st.snare.includes(s)) this.snare(t);
    if (st.hat.includes(s)) this.hat(t, st.hatGain);
    if (st.ride && s % 2 === 1) this.hat(t, st.hatGain * 0.35);
    if (s in st.bass) this.tone('sawtooth', midiHz(chord.root - 12 + st.bass[s]), t, sixteenth * 1.8, 0.16, 520);
    // Hợp âm nền kéo dài cả ô nhịp
    if (s === 0) for (const k of chord.tones) this.tone('triangle', midiHz(chord.root + 12 + k), t, sixteenth * 16, st.pad, 1800, 0.25);
    // Giai điệu
    if (st.lead === 'arp') {
      const k = chord.tones[s % 3] + (s % 6 >= 3 ? 12 : 0);
      this.tone('square', midiHz(chord.root + 24 + k), t, sixteenth * 0.8, 0.028, 2600);
    } else if (s % 4 === 0) {
      const pos = MELODY[bar][s / 4], k = pos === 3 ? 12 : chord.tones[pos];
      this.tone('square', midiHz(chord.root + 24 + k), t, sixteenth * 3, 0.035, 2000);
    }
  }

  // Một nốt nhạc: dao động kiểu type, lọc bớt âm cao, to lên nhanh rồi nhỏ dần
  tone(type, freq, t, dur, gain, cutoff, attack = 0.005) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  kick(t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.3);
  }

  noiseHit(t, cutoff, gain, dur) {
    const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise;
    f.type = 'highpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + dur + 0.02);
  }

  snare(t) {
    this.noiseHit(t, 1500, 0.32, 0.16);
    this.tone('triangle', 190, t, 0.08, 0.15, 3000, 0.002);
  }

  hat(t, gain) { this.noiseHit(t, 7000, gain, 0.045); }

  // ---------- Hiệu ứng âm thanh trong gara ----------
  // kind: 'click' (bấm nút), 'coin' (nhận tiền; count = số đồng xu kêu liên tiếp),
  //       'upgrade' (gắn đồ độ: cờ lê vặn ốc rồi siết "cạch"), 'paint' (xịt sơn), 'sell' (tháo đồ), 'buy' (mua xe)
  sfx(kind, count = 1) {
    if (!this.init()) return;
    this.ctx.resume();
    const t = this.ctx.currentTime + 0.02;
    if (kind === 'click') {
      // Tiếng "tích" ngắn, nhẹ
      this.blip('sine', 1400, 900, t, 0.05, 0.18);
    } else if (kind === 'coin') {
      // Tiếng đồng xu kiểu game: hai nốt nhảy lên, mỗi đồng cách nhau một chút; đồng cuối thêm tiếng ngân
      const n = Math.min(count, 6);
      for (let k = 0; k < n; k++) {
        const s = t + k * 0.11;
        this.blip('square', 988, 988, s, 0.07, 0.09);
        this.blip('square', 1319, 1319, s + 0.07, 0.22, 0.09);
      }
      const end = t + (n - 1) * 0.11 + 0.08;
      this.click(end, 6000, 0.25);
      for (const f of [2637, 3520]) this.blip('triangle', f, f, end, 0.6, 0.05);
    } else if (kind === 'upgrade') {
      // Tiếng cóc cờ lê: chuỗi tiếng tách nhỏ, nhanh dần
      for (let k = 0; k < 7; k++) this.click(t + k * 0.055 - k * k * 0.0015, 3200 + k * 120, 0.5);
      // Siết chặt: tiếng kim loại va mạnh, ngân ra
      this.clang(t + 0.42, 0.55);
      this.thump(t + 0.42, 0.7);
    } else if (kind === 'sell') {
      for (let k = 0; k < 4; k++) this.click(t + k * 0.07, 2600, 0.4);
      this.clang(t + 0.3, 0.3);
    } else if (kind === 'paint') {
      // Lắc bình sơn hai cái rồi xịt
      this.click(t, 1800, 0.5); this.click(t + 0.12, 1800, 0.5);
      this.hiss(t + 0.25, 0.65, 0.35);
    } else if (kind === 'buy') {
      this.thump(t, 0.9);
      this.clang(t + 0.05, 0.35);
      this.hiss(t + 0.1, 0.4, 0.15);
    }
  }

  // Một nốt hiệu ứng: cao độ trượt từ f0 tới f1, tắt dần trong dur giây
  blip(type, f0, f1, t, dur, gain) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.fx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Tiếng tách ngắn (bánh cóc, lẫy khóa)
  click(t, freq, gain) {
    const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise;
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 6;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    n.connect(f); f.connect(g); g.connect(this.fx);
    n.start(t, Math.random() * 0.3); n.stop(t + 0.05);
  }

  // Tiếng kim loại ngân: vài dao động lệch tần số nhau, tắt dần
  clang(t, gain) {
    const c = this.ctx;
    for (const [freq, k] of [[620, 1], [1310, 0.6], [2170, 0.4], [3020, 0.25]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(gain * k * 0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(this.fx);
      o.start(t); o.stop(t + 0.55);
    }
  }

  // Tiếng thịch trầm (đồ nặng đặt xuống)
  thump(t, gain) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(this.fx);
    o.start(t); o.stop(t + 0.25);
  }

  // Tiếng xì (xịt sơn, xả hơi)
  hiss(t, dur, gain) {
    const c = this.ctx, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise; n.loop = true;
    f.type = 'bandpass'; f.frequency.value = 5000; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.05);
    g.gain.setValueAtTime(gain, t + dur - 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(this.fx);
    n.start(t); n.stop(t + dur + 0.02);
  }
}
