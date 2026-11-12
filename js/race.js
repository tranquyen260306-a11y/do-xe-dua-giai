// Cuộc đua: đường đua 3D, xe người chơi, xe máy (AI), hộp số, nitro, tai nạn, tính vòng và thứ hạng.
import * as THREE from 'three';
import { makeCar } from './car.js';
import { OFFROAD, onDirt } from './data.js';

// Danh sách đường đua. points = các điểm mốc (x, z) tính bằng mét, đường cong sẽ đi mượt qua các điểm này.
// theme: 'park' (ban ngày, rừng thông), 'city' (phố đêm), 'dirt' (đường đất đồi dốc), 'coast' (ven biển).
// Muốn thêm đường đua mới: thêm một mục ở đây.
const scale = (pts, k) => pts.map(([x, z]) => [x * k, z * k]);
// Vòng xoáy: đi vòng quanh tâm (cx, cz) theo góc từ a0 tới a1, bán kính đổi dần từ r0 tới r1
function spiral(cx, cz, r0, r1, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + (a1 - a0) * t, r = r0 + (r1 - r0) * t;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
}
export const TRACKS = {
  circuit: {
    name: 'Trường đua Đồi Thông', desc: 'Ban ngày, giữa rừng thông. Cua rộng, dễ làm quen.', theme: 'park',
    points: scale([[0, 0], [120, -10], [190, 40], [170, 120], [90, 140], [60, 210], [-40, 230], [-120, 170], [-100, 90], [-160, 20], [-110, -50]], 1.7),
  },
  city: {
    name: 'Phố đêm', desc: 'Đường phố lúc chập tối. Đoạn thẳng dài, cua vuông góc, sát tường.', theme: 'city',
    points: [[0, 0], [130, 0], [260, 0], [300, 40], [300, 120], [300, 200], [260, 240], [140, 240], [100, 280],
      [100, 400], [60, 440], [-40, 440], [-140, 440], [-180, 400], [-180, 220], [-180, 40], [-140, 0]],
  },
  hills: {
    name: 'Đồi Xoáy', desc: 'Đường đất lên xuống dốc, hai vòng xoáy ốc. Sân chơi của xe bán tải.', theme: 'dirt',
    points: [[0, 0], [150, 0], [260, 60],
      ...spiral(300, 200, 60, 120, -Math.PI / 2, Math.PI * 1.1, 10),
      [120, 330], [-20, 300],
      ...spiral(-120, 180, 110, 50, Math.PI / 2, -Math.PI * 0.9, 9),
      [-120, 40], [-60, -30]],
  },
  coast: {
    name: 'Đường ven biển', desc: 'Chạy dọc bờ biển, cua liên tiếp, gió lộng.', theme: 'coast',
    points: scale([[0, 0], [90, 20], [160, -10], [250, 30], [300, 110], [250, 170], [160, 150], [90, 200], [0, 230], [-90, 190], [-140, 110], [-100, 40]], 1.6),
  },
  oval: {
    name: 'Oval tốc độ', desc: 'Hai đoạn thẳng rất dài, hai cua lớn. Chỉ có ga và ga.', theme: 'park',
    points: [[0, 0], [250, 0], [500, 0], [600, 60], [600, 200], [500, 260], [250, 260], [0, 260], [-100, 200], [-100, 60]],
  },
};

const THEMES = {
  park:  { top: 0x2f72d0, horizon: 0xcfe3f2, fog: [250, 1500], hemi: [0xdfeeff, 0x5d6b4a, 0.9], sun: [0xfff3dc, 2.2], sunPos: [90, 160, 50], ground: ['#4b8a3c', ['#3f7a33', '#5a9a47', '#447f37', '#528f41']] },
  city:  { top: 0x050818, horizon: 0x3b2f5e, fog: [180, 1200], hemi: [0x99a6ff, 0x221f2e, 1.0], sun: [0xb9c6ff, 1.1], sunPos: [-70, 150, 90], ground: ['#2c2e35', ['#33363e', '#25272d', '#3a3d46']] },
  dirt:  { top: 0x2b6fc9, horizon: 0xe8d9bf, fog: [220, 1400], hemi: [0xfff0d8, 0x6b5a3a, 1.0], sun: [0xffe9c4, 2.4], sunPos: [60, 150, -80], ground: ['#8a7a4e', ['#7a6a40', '#9b8a5a', '#6e6238', '#a3925f']] },
  coast: { top: 0x2a7fd6, horizon: 0xd8ecf7, fog: [300, 1600], hemi: [0xe6f2ff, 0x6a7a55, 1.0], sun: [0xfff6e0, 2.3], sunPos: [-90, 150, 60], ground: ['#5c9a46', ['#4f8a3a', '#6aa851', '#558f40']] },
};

const HALF = 11;           // nửa bề rộng mặt đường (đường rộng 22 m)
const KERB = 1.4;          // bề rộng lề sọc đỏ trắng ở cua
const WALL = HALF + 7.5;   // khoảng cách từ tim đường tới tường rào
const N = 600;             // số điểm mẫu dọc đường đua

// Hộp số: 5 cấp. Mỗi con số là tốc độ tối đa của số đó so với tốc độ tối đa của xe.
export const GEAR_RATIO = [0.2, 0.38, 0.58, 0.8, 1.0];
const NITRO_MAX = 100, NITRO_REFILL = 7, NITRO_DRAIN = 34;
const CRASH_SPEED = 7;     // chênh lệch tốc độ (m/s) khi va chạm để tính là tai nạn
const BLINK_TIME = 2.2;    // giây xe chớp chớp sau tai nạn
export const MAX_HITS = 3; // bị tông quá số này thì bị loại

const mod = (a, n) => ((a % n) + n) % n;
const lambert = (o) => new THREE.MeshLambertMaterial(o);

// Tạo ảnh bề mặt (nhựa đường, cỏ, khán giả...) bằng cách vẽ lên canvas, khỏi cần file ảnh
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function speckle(ctx, w, h, base, colors, count, size) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * size, 1 + Math.random() * size);
  }
}

export class Race {
  constructor(trackId = 'circuit') {
    this.id = trackId;
    this.track = TRACKS[trackId];
    const th = this.th = THEMES[this.track.theme];
    this.dirt = this.track.theme === 'dirt';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(th.horizon);
    this.scene.fog = new THREE.Fog(th.horizon, th.fog[0], th.fog[1]);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 4000);
    this.scene.add(new THREE.HemisphereLight(...th.hemi));
    this.sun = new THREE.DirectionalLight(...th.sun);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 500;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    // Số ngẫu nhiên có hạt giống cố định, để cảnh vật lần nào mở game cũng giống nhau
    let seed = 11;
    this.rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    this.spinners = [];

    this.buildTrack();
    this.buildSky();
    const theme = this.track.theme;
    if (theme === 'city') this.buildCity();
    else if (theme === 'dirt') this.buildHills();
    else this.buildPark(theme === 'coast');
    this.buildStart();
    this.cars = new THREE.Group();
    this.scene.add(this.cars);
    this.state = 'idle';
    this.events = [];
    this.hud = {};
  }

  // Độ cao mặt đất tại (x, z). Chỉ đường đất mới có đồi; các đường khác phẳng.
  height(x, z) {
    if (!this.dirt) return 0;
    return 7 * Math.sin(x / 70) + 6 * Math.sin(z / 55 + 1) + 5 * Math.sin((x + z) / 95) + 4 * Math.sin((x - z) / 60 + 2) + 22;
  }
  // Độ dốc theo hướng (fx, fz): dương = đang lên dốc
  slope(x, z, fx, fz) {
    if (!this.dirt) return 0;
    return (this.height(x + fx * 2, z + fz * 2) - this.height(x - fx * 2, z - fz * 2)) / 4;
  }

  // ---------- Đường đua ----------
  buildTrack() {
    const city = this.track.theme === 'city';
    const curve = new THREE.CatmullRomCurve3(
      this.track.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    this.pts = curve.getSpacedPoints(N).slice(0, N);
    this.length = curve.getLength();
    this.ds = this.length / N;
    this.center = new THREE.Box3().setFromPoints(this.pts).getCenter(new THREE.Vector3());

    this.tan = []; this.nor = []; this.yaw = [];
    for (let i = 0; i < N; i++) {
      const t = this.pts[mod(i + 1, N)].clone().sub(this.pts[mod(i - 1, N)]).normalize();
      this.tan.push(t);
      this.nor.push(new THREE.Vector3(t.z, 0, -t.x)); // hướng sang trái của đường
      this.yaw.push(Math.atan2(t.x, t.z));
    }
    // Độ cong có dấu tại từng điểm (1 / bán kính cua, dương = cua trái), làm mượt để xe máy không giật
    const raw = [];
    for (let i = 0; i < N; i++) {
      let d = this.yaw[mod(i + 1, N)] - this.yaw[mod(i - 1, N)];
      d = Math.atan2(Math.sin(d), Math.cos(d));
      raw.push(d / (2 * this.ds));
    }
    this.turn = raw.map((_, i) => {
      let s = 0;
      for (let j = -3; j <= 3; j++) s += raw[mod(i + j, N)];
      return s / 7;
    });
    this.curv = this.turn.map(Math.abs);

    // Mặt đất: phẳng, hoặc lưới có độ cao theo đồi
    const [base, cols] = this.th.ground;
    const groundTex = canvasTex(256, 256, (c, w, h) => speckle(c, w, h, base, cols, 9000, 2), 400, 400);
    const seg = this.dirt ? 200 : 1;
    const gg = new THREE.PlaneGeometry(5000, 5000, seg, seg);
    gg.rotateX(-Math.PI / 2);
    if (this.dirt) {
      const p = gg.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, this.height(p.getX(i) + this.center.x, p.getZ(i) + this.center.z) - 0.6);
      gg.computeVertexNormals();
    }
    const ground = new THREE.Mesh(gg, lambert({ map: groundTex }));
    ground.position.set(this.center.x, 0, this.center.z);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const surface = this.dirt
      ? canvasTex(256, 256, (c, w, h) => speckle(c, w, h, '#6b5a3c', ['#7a684a', '#5c4c30', '#857254', '#4f4229'], 14000, 1.8), 3, 1)
      : canvasTex(256, 256, (c, w, h) => speckle(c, w, h, '#3a3c41', ['#3f4146', '#36383c', '#414348', '#34363a'], 14000, 1.5), 3, 1);
    const road = (color, extra) => lambert({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra });
    const corner = (i) => this.curv[i] > 0.006;

    // Trên đồi, nền đường đắp rộng ra tới tường rào để không hở mặt đất
    if (this.dirt) this.add(this.ribbon(-WALL - 3, WALL + 3, -0.05, road(0x8a7a4e, { polygonOffsetFactor: 0, polygonOffsetUnits: 0 })));
    this.add(this.ribbon(-HALF, HALF, 0.02, road(0xffffff, { map: surface })));
    // Vệt bánh xe sẫm màu ở giữa đường, nơi xe hay chạy
    this.add(this.ribbon(-3.4, 3.4, 0.03, road(0x000000, { transparent: true, opacity: 0.16, polygonOffsetFactor: -4 })));
    if (!this.dirt) {
      this.add(this.ribbon(HALF - 0.35, HALF - 0.1, 0.035, road(0xf2f2f2, { polygonOffsetFactor: -6 })));
      this.add(this.ribbon(-HALF + 0.1, -HALF + 0.35, 0.035, road(0xf2f2f2, { polygonOffsetFactor: -6 })));
    }
    // Lề sọc đỏ trắng ở các khúc cua; trường đua thì có thêm bãi sỏi
    for (const s of [-1, 1]) {
      const a = s * HALF, b = s * (HALF + KERB);
      this.add(this.ribbon(a, b, 0.03, road(0xc62828, { polygonOffsetFactor: -3 }), (i) => corner(i) && i % 2 === 0));
      this.add(this.ribbon(a, b, 0.03, road(0xf2f2f2, { polygonOffsetFactor: -3 }), (i) => corner(i) && i % 2 === 1));
      if (!city && !this.dirt) this.add(this.ribbon(b, s * (WALL - 0.3), 0.015, road(0xc9b68a, { polygonOffsetFactor: -1 }), (i) => this.curv[i] > 0.012));
    }

    // Tường rào hai bên (đường đất thì là hàng rào gỗ thấp)
    const wallTex = this.dirt
      ? canvasTex(64, 32, (c) => {
        c.fillStyle = '#8a6a3c'; c.fillRect(0, 0, 64, 32);
        c.fillStyle = '#6b4f2a'; c.fillRect(0, 8, 64, 4); c.fillRect(0, 22, 64, 4); c.fillRect(30, 0, 4, 32);
      })
      : canvasTex(64, 32, (c) => {
        c.fillStyle = '#b9bcc2'; c.fillRect(0, 0, 64, 32);
        c.fillStyle = '#c62828'; c.fillRect(0, 0, 32, 12);
        c.fillStyle = '#f2f2f2'; c.fillRect(32, 0, 32, 12);
        c.fillStyle = '#8f9299'; c.fillRect(0, 30, 64, 2);
      });
    const wallMat = lambert({ map: wallTex, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const w = this.wall(s * WALL, -0.6, this.dirt ? 0.9 : 1.1, wallMat);
      w.castShadow = true;
      this.add(w);
    }
  }

  add(mesh) { mesh.receiveShadow = true; this.scene.add(mesh); return mesh; }

  // Dải băng nằm dọc đường đua, từ độ lệch a đến b so với tim đường, cao hơn mặt đất y.
  // keep(i) cho phép chỉ vẽ một số đoạn.
  ribbon(a, b, y, material, keep) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = this.pts[i % N], n = this.nor[i % N], v = i * this.ds / 10;
      const ax = p.x + n.x * a, az = p.z + n.z * a, bx = p.x + n.x * b, bz = p.z + n.z * b;
      pos.push(ax, this.height(ax, az) + y, az, bx, this.height(bx, bz) + y, bz);
      uv.push(0, v, 1, v);
      if (i < N && (!keep || keep(i))) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    return this.mesh(pos, uv, idx, material);
  }

  // Dải băng dựng đứng (tường rào) cách tim đường một khoảng off
  wall(off, y0, y1, material) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = this.pts[i % N], n = this.nor[i % N], u = i * this.ds / 6;
      const x = p.x + n.x * off, z = p.z + n.z * off, h = this.height(x, z);
      pos.push(x, h + y0, z, x, h + y1, z);
      uv.push(u, 1, u, 0);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    return this.mesh(pos, uv, idx, material);
  }

  mesh(pos, uv, idx, material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, material);
  }

  // Khoảng cách từ một điểm tới đường đua (tính tới tim đường)
  trackDist(x, z) {
    let best = Infinity;
    for (let i = 0; i < N; i += 2) {
      const p = this.pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  // ---------- Bầu trời ----------
  buildSky() {
    const rnd = this.rnd, th = this.th, m = new THREE.Matrix4(), col = new THREE.Color();
    const skyGeo = new THREE.SphereGeometry(3000, 24, 12);
    const top = new THREE.Color(th.top), low = new THREE.Color(th.horizon), sp = skyGeo.attributes.position, sc = [];
    for (let i = 0; i < sp.count; i++) {
      col.copy(low).lerp(top, Math.pow(Math.max(0, sp.getY(i) / 3000), 0.55));
      sc.push(col.r, col.g, col.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    this.sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    this.scene.add(this.sky);

    if (this.track.theme === 'city') {
      // Sao và trăng
      const stars = [];
      for (let i = 0; i < 700; i++) {
        const a = rnd() * Math.PI * 2, e = 0.12 + rnd() * 1.4;
        stars.push(Math.cos(a) * Math.cos(e) * 2800, Math.sin(e) * 2800, Math.sin(a) * Math.cos(e) * 2800);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
      this.sky.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
      const moon = new THREE.Mesh(new THREE.SphereGeometry(110, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff3d2, fog: false }));
      moon.position.set(-1100, 1150, 1900);
      this.sky.add(moon);
    } else {
      const cloud = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.85 }), 26);
      for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2, r = 700 + rnd() * 1500, s = 0.6 + rnd();
        m.makeScale(190 * s, 34 * s, 110 * s).setPosition(Math.cos(a) * r, 380 + rnd() * 260, Math.sin(a) * r);
        cloud.setMatrixAt(i, m);
      }
      this.sky.add(cloud);
    }
  }

  // Biển quảng cáo sau tường rào trên các đoạn thẳng. Ban đêm thì biển tự phát sáng.
  buildBoards(glow) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const boards = [];
    for (let i = 8; i < N; i += 14) if (this.curv[i] < 0.004) boards.push([i, i % 28 ? 1 : -1]);
    if (!boards.length) return;
    const material = glow ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : lambert({ color: 0xffffff });
    const board = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 2.4, 12), material, boards.length);
    const palette = glow
      ? [0xff2d6f, 0x21d4fd, 0xfff04d, 0x7dff5c, 0xff8a1f, 0xb467ff]
      : [0xe53935, 0x1e88e5, 0xfdd835, 0xffffff, 0x43a047, 0xfb8c00, 0x212121];
    boards.forEach(([i, s], k) => {
      const p = this.pts[i], n = this.nor[i];
      const x = p.x + n.x * s * (WALL + 1.2), z = p.z + n.z * s * (WALL + 1.2);
      q.setFromAxisAngle(up, this.yaw[i]);
      m.makeRotationFromQuaternion(q).setPosition(x, this.height(x, z) + 2.4, z);
      board.setMatrixAt(k, m);
      board.setColorAt(k, col.setHex(palette[k % palette.length]));
    });
    board.castShadow = !glow;
    this.scene.add(board);
  }

  // Trồng cây quanh đường đua. pineRatio = tỉ lệ cây thông so với cây tán tròn.
  buildTrees(count, gap, pineRatio) {
    const rnd = this.rnd, m = new THREE.Matrix4(), col = new THREE.Color(), c = this.center;
    const spots = [];
    for (let tries = 0; spots.length < count && tries < count * 20; tries++) {
      const x = c.x - 680 + rnd() * 1360, z = c.z - 520 + rnd() * 1040;
      if (this.trackDist(x, z) > gap) spots.push([x, z, 0.8 + rnd() * 1.0, rnd() < pineRatio]);
    }
    const pines = spots.filter(s => s[3]), rounds = spots.filter(s => !s[3]);
    const pine = new THREE.InstancedMesh(new THREE.ConeGeometry(2.8, 9, 7), lambert({ color: 0xffffff, flatShading: true }), Math.max(1, pines.length));
    const ball = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(3.4, 1), lambert({ color: 0xffffff, flatShading: true }), Math.max(1, rounds.length));
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 4, 6), lambert({ color: 0x6b4a2b }), Math.max(1, spots.length));
    pine.count = pines.length; ball.count = rounds.length; trunk.count = spots.length;
    pines.forEach(([x, z, s], i) => {
      m.makeScale(s, s, s).setPosition(x, this.height(x, z) + 7 * s, z); pine.setMatrixAt(i, m);
      pine.setColorAt(i, col.setHSL(0.37 + rnd() * 0.04, 0.45, 0.2 + rnd() * 0.08));
    });
    rounds.forEach(([x, z, s], i) => {
      m.makeScale(s, s * 0.9, s).setPosition(x, this.height(x, z) + 5.6 * s, z); ball.setMatrixAt(i, m);
      ball.setColorAt(i, col.setHSL(0.27 + rnd() * 0.07, 0.5, 0.26 + rnd() * 0.1));
    });
    spots.forEach(([x, z, s], i) => { m.makeScale(s, s, s).setPosition(x, this.height(x, z) + 2 * s, z); trunk.setMatrixAt(i, m); });
    pine.castShadow = ball.castShadow = true;
    this.scene.add(pine, ball, trunk);
  }

  // ---------- Cảnh trường đua ban ngày: núi, cây. coast = có biển ở phía nam ----------
  buildPark(coast) {
    const rnd = this.rnd, m = new THREE.Matrix4(), col = new THREE.Color(), c = this.center;
    const hills = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), lambert({ color: 0xffffff, flatShading: true }), 22);
    let n = 0;
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2 + rnd() * 0.2;
      const r = 1150 + rnd() * 400, w = 300 + rnd() * 320, h = 140 + rnd() * 260;
      if (coast && Math.sin(a) < -0.15) continue; // phía biển không có núi
      m.makeScale(w, h, w).setPosition(c.x + Math.cos(a) * r, h / 2 - 4, c.z + Math.sin(a) * r);
      hills.setMatrixAt(n, m);
      hills.setColorAt(n++, col.setHSL(0.36 + rnd() * 0.06, 0.28, 0.3 + rnd() * 0.1));
    }
    hills.count = n;
    this.scene.add(hills);

    if (coast) {
      // Biển và bãi cát ở phía nam đường đua; cây chỉ trồng phía đất liền
      const zShore = Math.min(...this.pts.map(p => p.z)) - WALL - 25;
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 3000), new THREE.MeshStandardMaterial({ color: 0x1f7fc4, roughness: 0.12, metalness: 0.5 }));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(c.x, 0.35, zShore - 1500 - 60);
      const sand = new THREE.Mesh(new THREE.PlaneGeometry(6000, 90), lambert({ color: 0xe8d9a8 }));
      sand.rotation.x = -Math.PI / 2;
      sand.position.set(c.x, 0.3, zShore - 20);
      this.scene.add(sea, sand);
      this.shoreZ = zShore;
    }
    this.buildTrees(coast ? 300 : 420, 30, coast ? 0.15 : 0.55);
    this.buildBoards(false);
  }

  // ---------- Cảnh đồi đất: cây thưa, tảng đá, cối xay gió ----------
  buildHills() {
    const rnd = this.rnd, m = new THREE.Matrix4(), col = new THREE.Color(), c = this.center;
    this.buildTrees(240, 34, 0.7);
    const spots = [];
    for (let tries = 0; spots.length < 160 && tries < 2000; tries++) {
      const x = c.x - 620 + rnd() * 1240, z = c.z - 480 + rnd() * 960;
      if (this.trackDist(x, z) > 26) spots.push([x, z, 1 + rnd() * 3]);
    }
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), lambert({ color: 0xffffff, flatShading: true }), spots.length);
    spots.forEach(([x, z, s], i) => {
      m.makeScale(s, s * 0.7, s).setPosition(x, this.height(x, z) + s * 0.2, z);
      rocks.setMatrixAt(i, m);
      rocks.setColorAt(i, col.setHSL(0.08, 0.1, 0.35 + rnd() * 0.2));
    });
    rocks.castShadow = true;
    this.scene.add(rocks);

    // Cối xay gió trên các đồi xa, cánh quay chậm
    const white = lambert({ color: 0xf0f0f0 });
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3 + 0.4, x = c.x + Math.cos(a) * 430, z = c.z + Math.sin(a) * 430, y = this.height(x, z);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2, 32, 8), white);
      tower.position.set(x, y + 16, z);
      const hub = new THREE.Group();
      hub.position.set(x, y + 32, z + 1.6);
      for (let b = 0; b < 3; b++) {
        const arm = new THREE.Group();
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.7, 15, 0.2), white);
        blade.position.y = 7.5;
        arm.add(blade);
        arm.rotation.z = b * Math.PI * 2 / 3;
        hub.add(arm);
      }
      this.spinners.push(hub);
      this.scene.add(tower, hub);
    }
  }

  // ---------- Cảnh phố đêm: nhà cao tầng sáng đèn, đèn đường, biển neon ----------
  buildCity() {
    const rnd = this.rnd, m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color(), c = this.center;

    // Ảnh mặt tiền 8x8 ô cửa sổ: một bản màu thường, một bản chỉ có ô sáng đèn để tự phát sáng trong đêm
    const lit = [];
    for (let i = 0; i < 64; i++) lit.push(Math.random() < 0.42 ? ['#ffd98a', '#fff1c9', '#bfe3ff', '#ffb45c'][i % 4] : null);
    const facade = (wallColor, dark) => (ctx, w, h) => {
      ctx.fillStyle = wallColor; ctx.fillRect(0, 0, w, h);
      const s = w / 8;
      for (let i = 0; i < 64; i++) {
        ctx.fillStyle = lit[i] || dark;
        ctx.fillRect((i % 8) * s + s * 0.2, Math.floor(i / 8) * s + s * 0.22, s * 0.6, s * 0.56);
      }
    };
    const types = [
      { w: 16, d: 16, h: 26, rx: 4, ry: 6 }, { w: 18, d: 18, h: 48, rx: 4, ry: 11 },
      { w: 22, d: 22, h: 85, rx: 5, ry: 19 }, { w: 28, d: 16, h: 15, rx: 7, ry: 3 },
    ];
    const lists = types.map(() => []), placed = [];
    const clash = (x, z, r) => placed.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + r + 1) ** 2);
    const put = (k, x, z, yaw, r) => { placed.push({ x, z, r }); lists[k].push([x, z, yaw]); };

    // Một dãy nhà chạy sát hai bên đường
    for (let i = 0; i < N; i += 5) {
      for (const s of [-1, 1]) {
        const k = Math.floor(rnd() * types.length), t = types[k], r = Math.max(t.w, t.d) / 2;
        const off = WALL + t.d / 2 + 2 + rnd() * 5, p = this.pts[i], n = this.nor[i];
        const x = p.x + n.x * s * off, z = p.z + n.z * s * off;
        if (this.trackDist(x, z) > WALL + t.d / 2 + 1 && !clash(x, z, r * 0.9)) put(k, x, z, this.yaw[i] + Math.PI / 2, r * 0.9);
      }
    }
    // Các khối nhà phía xa, lấp đầy thành phố
    for (let n = 0; n < 900; n++) {
      const k = rnd() < 0.5 ? 2 : Math.floor(rnd() * types.length), t = types[k], r = Math.max(t.w, t.d) * 0.71;
      const x = c.x - 560 + rnd() * 1120, z = c.z - 560 + rnd() * 1120;
      if (this.trackDist(x, z) > WALL + r + 2 && !clash(x, z, r)) put(k, x, z, Math.floor(rnd() * 2) * Math.PI / 2, r);
    }
    const roof = lambert({ color: 0x1a1c22 });
    types.forEach((t, k) => {
      if (!lists[k].length) return;
      const tint = ['#3b3f4a', '#2f3440', '#40434d', '#353846'][k];
      const map = canvasTex(256, 256, facade(tint, '#141821'), t.rx / 8, t.ry / 8);
      const glow = canvasTex(256, 256, facade('#000', '#000'), t.rx / 8, t.ry / 8);
      const side = lambert({ map, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0.95 });
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(t.w, t.h, t.d), [side, side, roof, roof, side, side], lists[k].length);
      lists[k].forEach(([x, z, yaw], i) => {
        q.setFromAxisAngle(up, yaw);
        m.makeRotationFromQuaternion(q).setPosition(x, t.h / 2, z);
        inst.setMatrixAt(i, m);
        inst.setColorAt(i, col.setHSL(0.6 + rnd() * 0.1, 0.12, 0.62 + rnd() * 0.38));
      });
      this.scene.add(inst);
    });

    // Đèn đường: cột, bóng đèn và vệt sáng trên mặt đường
    const lamps = [];
    for (let i = 3; i < N; i += 7) lamps.push([i, (i / 7 | 0) % 2 ? 1 : -1]);
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 8, 6), lambert({ color: 0x3a3d45 }), lamps.length);
    const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), lamps.length);
    const poolTex = canvasTex(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,220,160,0.75)'); g.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    });
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({
      map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -10,
    }), lamps.length);
    const flat = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    lamps.forEach(([i, s], k) => {
      const p = this.pts[i], n = this.nor[i];
      const x = p.x + n.x * s * (WALL + 0.7), z = p.z + n.z * s * (WALL + 0.7);
      m.identity().setPosition(x, 4, z); pole.setMatrixAt(k, m);
      m.identity().setPosition(x - n.x * s * 1.2, 8.1, z - n.z * s * 1.2); bulb.setMatrixAt(k, m);
      m.copy(flat).setPosition(p.x + n.x * s * 5, 0.07, p.z + n.z * s * 5); pool.setMatrixAt(k, m);
    });
    this.scene.add(pole, bulb, pool);

    this.buildBoards(true);
  }

  // ---------- Khu xuất phát: vạch caro và cổng; trường đua có thêm khán đài và nhà pit ----------
  // Trong nhóm này: +x là bên trái đường, +z là hướng xe chạy.
  buildStart() {
    const theme = this.track.theme, simple = theme === 'city' || theme === 'dirt';
    const start = new THREE.Group();
    start.position.copy(this.pts[0]);
    start.position.y = this.height(this.pts[0].x, this.pts[0].z);
    start.rotation.y = this.yaw[0];
    this.scene.add(start);
    const part = (w, h, d, material, x, y, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      b.position.set(x, y, z); b.castShadow = b.receiveShadow = true;
      start.add(b);
      return b;
    };
    const checker = (rx) => canvasTex(64, 64, (c) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, 64, 64);
      c.fillStyle = '#111'; c.fillRect(0, 0, 32, 32); c.fillRect(32, 32, 32, 32);
    }, rx, 1);
    if (!this.dirt) {
      const line = part(HALF * 2, 0.02, 2, lambert({ map: checker(8), polygonOffset: true, polygonOffsetFactor: -8 }), 0, 0.05, 0);
      line.castShadow = false;
    }
    const steel = lambert({ color: 0x4a4f58 });
    part(0.5, 10, 0.5, steel, HALF + 1.8, 3, 0);
    part(0.5, 10, 0.5, steel, -HALF - 1.8, 3, 0);
    part(HALF * 2 + 4.1, 1.5, 0.7, theme === 'city' ? new THREE.MeshBasicMaterial({ map: checker(14) }) : lambert({ map: checker(14) }), 0, 8, 0);
    if (simple) return;

    const crowd = canvasTex(256, 32, (c, w, h) =>
      speckle(c, w, h, '#6d7078', ['#e53935', '#fdd835', '#1e88e5', '#ffffff', '#fb8c00', '#2b2b2b', '#43a047'], 1100, 3), 6, 1);
    const seat = lambert({ map: crowd }), concrete = lambert({ color: 0xc3c7ce });
    for (let k = 0; k < 7; k++) part(2.6, (k + 1) * 1.2, 90, seat, -(WALL + 5 + k * 2.6), (k + 1) * 0.6, 10);
    part(22, 0.5, 94, lambert({ color: 0x2f5fa8 }), -(WALL + 12.5), 13, 10);
    for (const z of [-34, -5, 24, 54]) part(0.5, 13, 0.5, steel, -(WALL + 22.5), 6.5, z);
    const pitTex = canvasTex(128, 64, (c) => {
      c.fillStyle = '#e4e7ec'; c.fillRect(0, 0, 128, 64);
      c.fillStyle = '#26303d'; c.fillRect(8, 6, 112, 16);
      c.fillStyle = '#3d424b'; c.fillRect(14, 30, 100, 34);
      c.fillStyle = '#c62828'; c.fillRect(0, 24, 128, 3);
    }, 10, 1);
    part(12, 8, 100, [concrete, lambert({ map: pitTex }), concrete, concrete, concrete, concrete], WALL + 12, 4, 10);
    part(13, 0.4, 102, lambert({ color: 0x3a3f48 }), WALL + 12, 8.2, 10);
  }

  // Tốc độ an toàn tại từng điểm: không văng khỏi cua và kịp phanh trước cua kế tiếp
  speedProfile(st, skill) {
    const v = new Float32Array(N);
    for (let i = 0; i < N; i++) v[i] = Math.min(st.top, Math.sqrt(st.grip * skill / Math.max(this.curv[i], 1e-4)));
    for (let pass = 0; pass < 2; pass++) {
      for (let i = N - 1; i >= 0; i--) {
        const next = v[(i + 1) % N];
        v[i] = Math.min(v[i], Math.sqrt(next * next + 2 * st.brake * 0.8 * this.ds));
      }
    }
    return v;
  }

  // ---------- Bắt đầu cuộc đua ----------
  // opts: { stats, body, color, ..., laps, assist (trợ lái), manual (hộp số tay),
  //         rivals: [{ name, stats, skill, body, color, ... }] }
  start(opts, onFinish) {
    this.cars.clear();
    this.laps = opts.laps;
    this.onFinish = onFinish;
    this.time = 0;
    this.countdown = 3;
    this.state = 'countdown';
    this.finishedCount = 0;
    this.finalRank = 0;
    this.manual = !!opts.manual;
    this.events = []; // thông báo ngắn hiện trên màn hình (tai nạn, bị loại...)

    // Trên đường đất, xe gầm thấp bị yếu đi
    const adapt = (st, body) => (this.dirt ? onDirt(st, OFFROAD[body] || 0) : st);
    const stats = adapt(opts.stats, opts.body);
    // Trợ lái: tính sẵn tốc độ an toàn cho xe người chơi để tự phanh trước cua
    this.assistProf = opts.assist ? this.speedProfile(stats, 0.9) : null;

    const slot = (k) => ({ back: 3 + k * 3, side: k % 2 ? -4.2 : 4.2 });
    const lanes = [-7.2, 3.6, -3.6, 7.2, 0];

    this.ai = opts.rivals.map((r, k) => {
      const mesh = makeCar(r);
      this.cars.add(mesh);
      const g = slot(k), st = adapt(r.stats, r.body);
      return { ...r, stats: st, mesh, s: -g.back * this.ds, v: 0, off: g.side, lane: lanes[k % lanes.length],
        prof: this.speedProfile(st, r.skill), finished: false, finishTime: 0, hits: 0, blink: 0, out: false, x: 0, z: 0 };
    });

    // Người chơi xuất phát cuối đoàn
    const g = slot(opts.rivals.length);
    const i0 = mod(-g.back, N);
    const mesh = makeCar(opts);
    this.cars.add(mesh);
    this.player = {
      mesh, st: stats, v: 0, steer: 0, roll: 0, pitch: 0, idx: i0, prog: -g.back, offTrack: false, gas: false,
      autoBrake: false, inWall: false, wallHits: 0, maxV: 0, dist: 0, side: g.side,
      gear: 1, rpm: 0, nitro: NITRO_MAX, boosting: false, hits: 0, blink: 0, out: false, crashes: 0,
      x: this.pts[i0].x + this.nor[i0].x * g.side, z: this.pts[i0].z + this.nor[i0].z * g.side,
      yaw: this.yaw[i0],
    };
    this.ai.forEach(a => this.placeAi(a, 0));
    this.placePlayer();
    this.updateCamera(1, true);
    this.updateHud();
  }

  stop() { this.state = 'idle'; }

  // Bảng xếp hạng: [{ name, time, out }], người chơi có name = null.
  // Xe đã về đích xếp theo thời gian, xe chưa về xếp theo quãng đường, xe bị loại xếp cuối.
  standings() {
    const p = this.player;
    const me = { name: null, time: this.time, prog: p.prog * this.ds, finished: this.state === 'done' && !p.out, out: p.out };
    const all = [...this.ai.map(a => ({ name: a.name, time: a.finishTime, prog: a.s, finished: a.finished, out: a.out })), me];
    return all.sort((a, b) => {
      if (a.out !== b.out) return a.out ? 1 : -1;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return a.finished ? a.time - b.time : b.prog - a.prog;
    });
  }

  // ---------- Mỗi khung hình ----------
  update(dt, input) {
    if (this.state === 'idle') return;
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.state = 'go';
    } else if (this.state === 'go') {
      this.time += dt;
    }
    if (this.state !== 'countdown') this.ai.forEach(a => this.updateAi(a, dt));
    this.updatePlayer(dt, input);
    this.updateCamera(dt, false);
    for (const s of this.spinners) s.rotation.z += dt * 0.8;
    this.events = this.events.filter(e => (e.t -= dt) > 0);
    this.updateHud();
  }

  say(text) { this.events.push({ text, t: 2.6 }); }

  // Một xe (người hoặc máy) bị tông: chớp chớp, mất tốc độ rồi chạy tiếp; bị quá số lần cho phép thì bị loại
  hitCar(c, isPlayer) {
    if (c.blink > 0 || c.out) return;
    c.hits++;
    c.blink = BLINK_TIME;
    c.v = Math.min(c.v, 6);
    const name = isPlayer ? 'Bạn' : c.name;
    if (c.hits > MAX_HITS) {
      c.out = true;
      this.say(`${name} bị loại vì bị tông ${c.hits} lần!`);
      if (!isPlayer) c.mesh.visible = false;
    } else {
      this.say(`${name} bị tông! (${c.hits}/${MAX_HITS})`);
    }
  }

  updateAi(a, dt) {
    if (a.out) return;
    const i = mod(Math.floor(a.s / this.ds), N);
    let target = a.finished ? 12 : a.prof[i];
    if (a.blink > 0) { a.blink -= dt; target = Math.min(target, 14); }
    if (a.v < target) a.v = Math.min(target, a.v + a.stats.accel * (1 - (a.v / a.stats.top) ** 2) * dt + 0.01);
    else a.v = Math.max(target, a.v - a.stats.brake * dt);
    a.s += a.v * dt;
    a.off += (a.lane - a.off) * Math.min(1, dt * 0.25); // từ ô xuất phát dạt dần về làn của mình
    if (!a.finished && a.s >= this.laps * this.length) { a.finished = true; a.finishTime = this.time; this.finishedCount++; }
    this.placeAi(a, a.v * dt);
    a.mesh.visible = a.blink <= 0 || Math.floor(a.blink * 10) % 2 === 0;
  }

  placeAi(a, dist) {
    const f = a.s / this.ds, i = mod(Math.floor(f), N), j = (i + 1) % N, t = f - Math.floor(f);
    const p = this.pts[i], q = this.pts[j], n = this.nor[i];
    a.x = p.x + (q.x - p.x) * t + n.x * a.off;
    a.z = p.z + (q.z - p.z) * t + n.z * a.off;
    let d = this.yaw[j] - this.yaw[i];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const yaw = this.yaw[i] + d * t;
    a.mesh.position.set(a.x, this.height(a.x, a.z), a.z);
    a.mesh.rotation.set(-Math.atan(this.slope(a.x, a.z, Math.sin(yaw), Math.cos(yaw))), yaw,
      Math.atan(a.v * a.v * this.turn[i] / 9.8) * 0.06, 'YXZ');
    a.mesh.userData.drive(dist, Math.max(-0.5, Math.min(0.5, this.turn[i] * 12)));
  }

  updatePlayer(dt, input) {
    const p = this.player, st = p.st;
    const driving = this.state === 'go' && !p.out;
    const want = driving ? (input.left ? 1 : 0) - (input.right ? 1 : 0) : 0;
    // Vô lăng quay từ từ chứ không giật cục: xe càng nhanh quay càng chậm cho dễ chỉnh, nhả phím thì trả lái nhanh
    const rate = want === 0 ? 9 : 6.5 - 3.5 * Math.min(1, p.v / st.top);
    p.steer += (want - p.steer) * Math.min(1, dt * rate);
    p.gas = driving && input.gas;
    // Vừa bị tông: đang chớp thì xe chỉ bò chậm
    if (p.blink > 0) { p.blink -= dt; if (p.v > 14) p.gas = false; }

    // Trợ lái: gần tới tốc độ an toàn thì nhả ga dần, vượt quá thì phanh dần.
    // Làm từ từ chứ không bật tắt đột ngột, để xe không bị giật khi chạy sát ngưỡng.
    let brake = input.brake || this.state === 'done' ? 1 : 0, throttle = 1;
    p.autoBrake = false;
    if (this.assistProf && driving) {
      const over = p.v - this.assistProf[p.idx];
      throttle = Math.max(0, Math.min(1, (1 - over) / 3));
      const auto = Math.max(0, Math.min(1, (over - 0.5) / 2.5));
      if (auto > brake) { brake = auto; p.autoBrake = auto > 0.3; }
    }

    // Hộp số. Số tay: theo phím 1..5. Số tự động: lên số khi gần chạm ngưỡng của số đang gài.
    if (this.manual) {
      if (input.gear) p.gear = input.gear;
    } else {
      let g = 1;
      while (g < 5 && p.v > st.top * GEAR_RATIO[g - 1] * 0.95) g++;
      p.gear = g;
    }
    const gearTop = st.top * GEAR_RATIO[p.gear - 1];
    p.rpm = Math.min(1, p.v / gearTop);
    // Sức kéo: gài đúng số thì kéo hết sức; chạm ngưỡng của số thì hết lực; gài số cao lúc xe còn chậm thì ì.
    // Tự sang số đúng lúc bằng số tay được thưởng thêm một chút sức kéo so với số tự động.
    let fit = 1;
    if (p.rpm >= 1 && p.gear < 5) fit = 0;
    else if (p.gear > 1 && p.rpm < 0.45) fit = 0.3 + 0.7 * p.rpm / 0.45;
    let power = st.accel * Math.max(0, 1 - (p.v / st.top) ** 2) * fit * (this.manual ? 1.05 : 1);

    // Nitro (phím M): tăng sức kéo và cho vượt tốc độ tối đa một chút. Bình tự nạp lại khi không dùng.
    p.boosting = !!(driving && input.boost && p.nitro > 0 && p.gas);
    if (p.boosting) p.nitro = Math.max(0, p.nitro - NITRO_DRAIN * dt);
    else p.nitro = Math.min(NITRO_MAX, p.nitro + NITRO_REFILL * dt);
    p.mesh.userData.boost(p.boosting);
    const topNow = p.boosting ? st.top * 1.18 : st.top;
    if (p.boosting) power = Math.max(power * 2.2, st.accel * 0.9 * Math.max(0, 1 - p.v / topNow));

    const v0 = p.v;
    if (p.gas) p.v += (power * throttle - 1.5 * (1 - throttle)) * dt;
    else p.v -= 1.5 * dt;
    // Vượt ngưỡng của số đang gài (về số thấp lúc đang nhanh): máy ghì xe lại
    if (!p.boosting && p.v > gearTop) p.v -= 9 * dt;
    p.v -= st.brake * brake * dt;
    if (p.offTrack && p.v > 14) p.v -= 16 * dt; // chạy ra khỏi mặt đường thì bị ghì lại
    // Dốc: lên dốc chậm lại, xuống dốc trôi nhanh hơn
    p.v -= 9.8 * this.slope(p.x, p.z, Math.sin(p.yaw), Math.cos(p.yaw)) * 0.5 * dt;
    p.v = Math.max(0, Math.min(p.v, topNow * 1.05));

    // Chậm thì bị giới hạn bởi góc đánh lái, nhanh thì bị giới hạn bởi độ bám của lốp
    const maxYaw = Math.min(p.v / 6.5, st.grip / Math.max(p.v, 2));
    const yawRate = p.steer * maxYaw;
    p.yaw += yawRate * dt;
    // Trợ lái: khi không bấm lái, đầu xe tự nắn nhẹ theo hướng đường, và lái vào lại nếu đang lệch gần mép đường
    if (this.assistProf && want === 0 && p.v > 5) {
      const drift = Math.abs(p.side) > 4 ? p.side - Math.sign(p.side) * 4 : 0;
      let d = this.yaw[mod(p.idx + 3, N)] - Math.max(-0.4, Math.min(0.4, drift * 0.06)) - p.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.yaw += Math.max(-maxYaw, Math.min(maxYaw, d * 1.6)) * dt;
    }
    p.x += Math.sin(p.yaw) * p.v * dt;
    p.z += Math.cos(p.yaw) * p.v * dt;
    p.dist += p.v * dt;
    p.maxV = Math.max(p.maxV, p.v);

    // Va chạm với xe khác. Chạm nhẹ: bị đẩy ra. Tông mạnh: thành tai nạn, xe nằm phía trước là xe bị tông.
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    for (const a of this.ai) {
      if (a.out || a.blink > 0 || p.blink > 0 || p.out) continue;
      const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz);
      if (d >= 2.8 || d < 0.01) continue;
      p.x += dx / d * (2.8 - d); p.z += dz / d * (2.8 - d);
      const aiAhead = -(dx * fx + dz * fz) > 0;
      if (driving && Math.abs(p.v - a.v) > CRASH_SPEED) {
        if (aiAhead) { this.hitCar(a, false); p.crashes++; p.v *= 0.6; }
        else this.hitCar(p, true);
      } else if (aiAhead) {
        p.v = Math.min(p.v, Math.max(a.v * 0.92, 4));
      }
    }

    // Tìm điểm trên đường đua gần xe nhất để biết đã chạy được bao xa
    let best = 0, bestD = Infinity;
    for (let j = -12; j <= 12; j++) {
      const q = this.pts[mod(p.idx + j, N)];
      const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < bestD) { bestD = d; best = j; }
    }
    p.idx = mod(p.idx + best, N);
    p.prog += best;
    const c = this.pts[p.idx], n = this.nor[p.idx];
    const side = (p.x - c.x) * n.x + (p.z - c.z) * n.z; // lệch khỏi tim đường, dương = lệch trái
    p.side = side;
    p.offTrack = Math.abs(side) > HALF + KERB;

    // Chạm tường rào: bị chặn lại, cạ tường mất tốc độ, đầu xe bị bẻ dọc theo tường
    const lim = WALL - 1.2, hit = Math.abs(side) > lim;
    if (hit && !p.inWall && driving) p.wallHits++;
    p.inWall = hit;
    if (hit) {
      const over = side - Math.sign(side) * lim;
      p.x -= n.x * over; p.z -= n.z * over;
      p.v *= Math.max(0, 1 - 2.5 * dt);
      let d = this.yaw[p.idx] - p.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.yaw += d * Math.min(1, dt * 4);
    }
    if (input.reset) this.resetPlayer();

    // Thân xe nghiêng ra ngoài khi cua, chúi đầu khi phanh, ngóc đầu khi tăng ga
    const roll = Math.atan(p.v * yawRate / 9.8) * 0.08;
    const pitch = Math.max(-0.035, Math.min(0.035, -(p.v - v0) / Math.max(dt, 1e-3) * 0.0025));
    p.roll += (roll - p.roll) * Math.min(1, dt * 8);
    p.pitch += (pitch - p.pitch) * Math.min(1, dt * 3);
    p.mesh.userData.drive(p.v * dt, p.steer * 0.45);
    this.placePlayer();
    p.mesh.visible = p.blink <= 0 || Math.floor(p.blink * 10) % 2 === 0;

    if (this.state === 'go' && (p.out || p.prog >= this.laps * N)) {
      this.state = 'done';
      const order = this.standings();
      this.finalRank = order.findIndex(o => o.name === null) + 1;
      if (this.onFinish) this.onFinish({
        rank: this.finalRank, total: this.ai.length + 1, time: this.time, out: p.out,
        wallHits: p.wallHits, crashes: p.crashes, maxKmh: Math.round(p.maxV * 3.6), distKm: p.dist / 1000,
        standings: order,
      });
    }
  }

  // Đưa xe về giữa đường khi bấm R
  resetPlayer() {
    const p = this.player, c = this.pts[p.idx];
    p.x = c.x; p.z = c.z; p.yaw = this.yaw[p.idx]; p.v = 0; p.steer = 0;
  }

  placePlayer() {
    const p = this.player;
    p.mesh.position.set(p.x, this.height(p.x, p.z), p.z);
    p.mesh.rotation.set(p.pitch - Math.atan(this.slope(p.x, p.z, Math.sin(p.yaw), Math.cos(p.yaw))), p.yaw, p.roll, 'YXZ');
  }

  updateCamera(dt, snap) {
    const p = this.player;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const cx = p.x - fx * 8.2, cz = p.z - fz * 8.2;
    const want = new THREE.Vector3(cx, Math.max(this.height(cx, cz), this.height(p.x, p.z)) + 3.1, cz);
    if (snap) this.camera.position.copy(want);
    else this.camera.position.lerp(want, 1 - Math.exp(-6 * dt));
    this.camera.lookAt(p.x + fx * 5, this.height(p.x + fx * 5, p.z + fz * 5) + 1.2, p.z + fz * 5);
    // Góc nhìn mở rộng dần theo tốc độ và khi bơm nitro, đổi từ từ để hình không giật
    const fov = 60 + p.v * 0.22 + (p.boosting ? 7 : 0);
    this.camera.fov += (fov - this.camera.fov) * (snap ? 1 : Math.min(1, dt * 4));
    this.camera.updateProjectionMatrix();
    // Bầu trời và bóng đổ đi theo xe. Vùng bóng đổ chỉ dời theo từng nấc 4 m chứ không trượt liên tục,
    // để mép bóng không bị rung rinh khi xe chạy nhanh.
    const [sx, sy, sz] = this.th.sunPos, step = 4;
    const gx = Math.round(p.x / step) * step, gz = Math.round(p.z / step) * step, y = this.height(gx, gz);
    this.sky.position.set(p.x, 0, p.z);
    if (gx !== this.sunX || gz !== this.sunZ || snap) {
      this.sunX = gx; this.sunZ = gz;
      this.sun.position.set(gx + sx, y + sy, gz + sz);
      this.sun.target.position.set(gx, y, gz);
    }
  }

  updateHud() {
    const p = this.player;
    const dist = p.prog * this.ds;
    const ahead = this.ai.filter(a => !a.out && a.s > dist).length;
    this.hud = {
      kmh: Math.round(p.v * 3.6),
      speed: p.v, top: p.st.top, gas: p.gas,
      gear: p.gear, rpm: p.rpm, manual: this.manual, nitro: p.nitro / NITRO_MAX, boosting: p.boosting,
      hits: p.hits,
      lap: Math.min(this.laps, Math.max(1, Math.floor(p.prog / N) + 1)),
      laps: this.laps,
      pos: this.state === 'done' ? this.finalRank : ahead + 1,
      total: this.ai.length + 1,
      time: this.time,
      // 3, 2, 1 khi đếm ngược; 0 = "ĐI!" trong giây đầu; -1 = ẩn
      countdown: this.state === 'countdown' ? Math.ceil(this.countdown) : (this.time < 1 && this.state === 'go' ? 0 : -1),
      offTrack: p.offTrack, autoBrake: p.autoBrake,
      message: this.events.length ? this.events[this.events.length - 1].text : '',
    };
  }
}
