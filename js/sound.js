// Tiếng máy xe tạo bằng Web Audio, không cần file âm thanh.
// Cao độ đi theo vòng tua của số đang gài: mỗi lần lên số thì tiếng máy tụt xuống rồi rú lên lại.
export class EngineSound {
  constructor() { this.on = true; this.ctx = null; }

  // Trình duyệt chỉ cho phát tiếng sau khi người chơi bấm nút, nên gọi hàm này lúc bấm "Vào đua"
  start() {
    if (!this.on) return;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 900;
        this.low = this.ctx.createOscillator(); this.low.type = 'sawtooth';
        this.high = this.ctx.createOscillator(); this.high.type = 'square';
        const mix = this.ctx.createGain(); mix.gain.value = 0.35;
        this.low.connect(filter); this.high.connect(mix); mix.connect(filter);
        filter.connect(this.gain); this.gain.connect(this.ctx.destination);
        this.low.start(); this.high.start();
      }
      this.ctx.resume();
    } catch { this.ctx = null; }
  }

  // rpm: vòng tua 0..1, gear: số đang gài 1..5, gas: đang đạp ga, boost: đang bơm nitro
  update(rpm, gear, gas, boost) {
    if (!this.ctx) return;
    const f = 46 + (0.25 + rpm * 0.75) * 100 + gear * 5 + (boost ? 18 : 0), t = this.ctx.currentTime;
    this.low.frequency.setTargetAtTime(f, t, 0.05);
    this.high.frequency.setTargetAtTime(f * 2.01, t, 0.05);
    this.gain.gain.setTargetAtTime(this.on ? (boost ? 0.12 : gas ? 0.09 : 0.04) : 0, t, 0.08);
  }

  stop() { if (this.ctx) this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); }

  toggle() {
    this.on = !this.on;
    if (this.on) this.start(); else this.stop();
    return this.on;
  }
}
