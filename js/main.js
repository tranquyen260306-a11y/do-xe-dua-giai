// Điều phối game: bản lưu, tạo nhân vật, gara / tiệm đồ / custom / giải đua, bục vinh danh và vòng lặp vẽ hình.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CARS, PARTS, CLASSES, COLORS, AI_NAMES, START_MONEY, SELL_RATE, MISSIONS, DAILY,
  MUSIC, KITS, GLOW_PRICE, GLOW_COLORS, TEXT_COLORS, SKINS, HAIRS, SUITS, PATTERNS, ACCESSORIES, TITLES,
  getCar, emptyParts, calcStats, totalLevel, aiStats, missionProgress,
} from './data.js';
import { makeCar, loadCars } from './car.js';
import { makeCharacter } from './character.js';
import { Race, TRACKS, MAX_HITS } from './race.js';
import { EngineSound } from './sound.js';
import { Music } from './music.js';

const $ = (id) => document.getElementById(id);
const money = (n) => n.toLocaleString('vi-VN') + ' $';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Bản lưu (nằm trong trình duyệt của người chơi) ----------
const SAVE_KEY = 'doxe_save_v3';

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.owned && s.owned[s.carId] && getCar(s.carId)) return s;
  } catch { /* bản lưu hỏng hoặc trình duyệt chặn: chơi lại từ đầu */ }
  return {
    money: START_MONEY, carId: 'hatch', wins: 0, best: {},
    owned: { hatch: { parts: emptyParts(), color: COLORS[0] } },
  };
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* bỏ qua */ }
}

const save = loadSave();
if (!TRACKS[save.track]) save.track = 'circuit';
// Bổ sung các mục mới cho bản lưu cũ
save.stats ||= { wins: save.wins || 0 };
save.claimed ||= {};
if (save.assist === undefined) save.assist = true;
if (save.manual === undefined) save.manual = false;
const cur = () => save.owned[save.carId];
// Thông số dựng xe 3D của chiếc đang chọn
const carLook = () => {
  const c = cur(), p = c.parts;
  return {
    body: getCar(save.carId).body, color: c.color, po: p.po || 0, wing: p.canh || 0,
    text: c.text || '', textColor: c.textColor || TEXT_COLORS[0], plate: c.plate || '',
    kit: c.kit || 0, glow: c.glow || '',
  };
};

// Nhiệm vụ hằng ngày: sang ngày mới thì tính lại từ đầu
function daily() {
  const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  if (!save.daily || save.daily.date !== today) save.daily = { date: today, races: 0, claimed: false };
  return save.daily;
}
// Danh sách nhiệm vụ kèm tiến độ: { ...nhiệm vụ, value, done, claimed }
function missionList() {
  const dl = daily();
  return [
    { ...DAILY, value: dl.races, claimed: dl.claimed },
    ...MISSIONS.map(m => ({ ...m, value: missionProgress(save, m), claimed: !!save.claimed[m.id] })),
  ].map(m => ({ ...m, done: m.value >= m.target }));
}
const claimable = () => missionList().filter(m => m.done && !m.claimed).length;

// Ngoại hình của đối thủ máy: suy ra từ tên để lần nào cũng giống nhau
const pick = (slot, n) => ACCESSORIES[slot].items[n % ACCESSORIES[slot].items.length].id;
function lookOf(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { skin: SKINS[h % SKINS.length], hair: HAIRS[(h >>> 3) % HAIRS.length], hat: pick('hat', h >>> 6), face: pick('face', h >>> 12), neck: pick('neck', h >>> 16), pattern: PATTERNS[(h >>> 9) % PATTERNS.length].id };
}

// ---------- Khung 3D ----------
const isTouch = window.matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // giới hạn độ nét để máy yếu vẫn mượt
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Ánh sáng phản chiếu trên nước sơn và kính xe
const envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

// Gara: sàn xoay để ngắm xe. Cảnh này cũng dùng cho màn tạo nhân vật và bục vinh danh.
const garage = new THREE.Scene();
garage.background = new THREE.Color(0x14161c);
garage.environment = envMap;
garage.add(new THREE.HemisphereLight(0xffffff, 0x3a4050, 1.6));
const fill = new THREE.DirectionalLight(0xffffff, 1.8);
fill.position.set(-4, 3, 6);
garage.add(fill);
const lamp = new THREE.SpotLight(0xffffff, 600, 30, 0.6, 0.6);
lamp.position.set(3, 9, 4);
lamp.castShadow = true;
lamp.shadow.mapSize.set(1024, 1024);
garage.add(lamp);
const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.1, 64),
  new THREE.MeshStandardMaterial({ color: 0x4a505c, roughness: 0.5, metalness: 0.1 }));
floor.position.y = -0.05;
floor.receiveShadow = true;
garage.add(floor);
const garageCam = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
const turntable = new THREE.Group();   // xe và tay đua, xoay chậm
const stage = new THREE.Group();       // bục vinh danh, đứng yên
garage.add(turntable, stage);

let mode = 'garage'; // 'creator' | 'garage' | 'race' | 'podium'
let draft = null;    // nhân vật đang được chỉnh trong màn tạo nhân vật

function refreshGarage() {
  turntable.clear();
  stage.clear();
  if (mode === 'creator') {
    const ch = makeCharacter(draft);
    ch.scale.setScalar(1.25);
    turntable.add(ch);
    return;
  }
  turntable.add(makeCar(carLook()));
  if (save.driver) {
    const ch = makeCharacter({ suit: SUITS[0], ...save.driver });
    ch.position.set(1.75, 0, 0.5);
    ch.rotation.y = Math.PI / 2;
    turntable.add(ch);
  }
}

// Nhãn chữ nổi (tên tay đua, số trên bục)
function label(text, color = '#ffffff', size = 1) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '900 64px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(text, 256, 64);
  ctx.fillStyle = color; ctx.fillText(text, 256, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(2.4 * size, 0.6 * size, 1);
  return s;
}

// Bục vinh danh: ba bậc 1, 2, 3 và ba tay đua về đầu. top = [{ name, look, suit }]
function buildPodium(top) {
  turntable.clear();
  stage.clear();
  const spots = [{ x: 0, h: 1.1, c: 0xf2c230 }, { x: -1.7, h: 0.75, c: 0xc0c5cc }, { x: 1.7, h: 0.5, c: 0xc47a3a }];
  top.slice(0, 3).forEach((r, k) => {
    const s = spots[k];
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, s.h, 1.4), new THREE.MeshStandardMaterial({ color: s.c, roughness: 0.4, metalness: 0.5 }));
    block.position.set(s.x, s.h / 2, 0);
    block.castShadow = block.receiveShadow = true;
    const num = label(String(k + 1), '#111111', 0.9);
    num.position.set(s.x, s.h / 2, 0.75);
    const ch = makeCharacter({ ...r.look, suit: r.suit, cheer: k === 0 });
    ch.position.set(s.x, s.h, 0);
    const name = label(r.name, k === 0 ? '#ffd54a' : '#ffffff', 0.8);
    name.position.set(s.x, s.h + 2.25, 0);
    stage.add(block, num, ch, name);
  });
}

// Mỗi đường đua chỉ dựng cảnh một lần, lúc được chọn lần đầu
const races = {};
function getRace(id) {
  if (!races[id]) {
    const r = races[id] = new Race(id);
    r.scene.environment = envMap;
    if (isTouch) r.sun.shadow.mapSize.set(1024, 1024);
    r.camera.aspect = window.innerWidth / window.innerHeight;
    r.camera.updateProjectionMatrix();
  }
  return races[id];
}
let race = getRace(save.track);
const engine = new EngineSound();

// ---------- Nhạc nền và tiếng cơ khí trong gara ----------
const music = new Music(MUSIC);
// Đang phát bài bạn chọn thì hiện tên bài và nút chuyển bài
music.onTrack = (name) => {
  $('music-btn').title = name ? `Đang phát: ${name}` : 'Bật / tắt nhạc nền';
  $('music-next').hidden = !name || (MUSIC[music.style] || []).length < 2;
};
$('music-next').addEventListener('click', () => music.nextTrack());
music.on = save.music ? save.music.on : true;
music.vol = save.music ? save.music.vol : 0.5;
function musicLabels() {
  $('music-btn').textContent = `♪ Nhạc: ${music.on ? 'bật' : 'tắt'}`;
  $('music-vol').value = Math.round(music.vol * 100);
}
function saveMusic() { save.music = { on: music.on, vol: music.vol }; persist(); }
function toggleMusic() { music.toggle(); saveMusic(); musicLabels(); }
$('music-btn').addEventListener('click', toggleMusic);
$('music-vol').addEventListener('input', (e) => { music.setVolume(e.target.value / 100); saveMusic(); });
// Trình duyệt chỉ cho phát tiếng sau lần bấm hoặc gõ phím đầu tiên
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => music.start(), { once: true });
musicLabels();

// Đặt máy quay gara theo màn hình đang hiện và đẩy cảnh sang phần không bị bảng che
function applyView() {
  const w = window.innerWidth, h = window.innerHeight, wide = w > 760;
  if (mode === 'podium') {
    garageCam.position.set(0, 2.4, 9.4); garageCam.lookAt(0, 1.7, 0); garageCam.fov = wide ? 40 : 62;
    // Màn hình rộng: bảng kết quả nằm bên phải, bục bên trái. Màn hình hẹp: bảng nằm dưới, bục ở trên.
    if (wide) garageCam.setViewOffset(w, h, Math.min(250, w / 4), 0, w, h);
    else garageCam.setViewOffset(w, h, 0, h * 0.27, w, h);
  } else {
    if (mode === 'creator') { garageCam.position.set(2.4, 1.9, 4.6); garageCam.lookAt(0, 1.15, 0); }
    else { garageCam.position.set(6.3, 2.5, 7.1); garageCam.lookAt(0, 0.7, 0); }
    garageCam.fov = wide ? 38 : 58; // màn hình hẹp thì lùi máy quay ra để thấy trọn xe
    if (wide) garageCam.setViewOffset(w, h, Math.min(230, w / 4), 0, w, h);
    else garageCam.setViewOffset(w, h, 0, h * 0.27, w, h);
  }
  garageCam.aspect = w / h;
  garageCam.updateProjectionMatrix();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  for (const r of Object.values(races)) { r.camera.aspect = w / h; r.camera.updateProjectionMatrix(); }
  applyView();
}
window.addEventListener('resize', resize);

// ---------- Giao diện gara ----------
let tab = 'gara';

const STAT_VIEW = [
  ['top', 'Tốc độ', 115, (v) => Math.round(v * 3.6) + ' km/h'],
  ['accel', 'Độ bốc', 16.5, (v) => v.toFixed(1)],
  ['grip', 'Độ bám', 22.5, (v) => v.toFixed(1)],
  ['brake', 'Phanh', 28, (v) => v.toFixed(1)],
];
function statBars(st) {
  return STAT_VIEW.map(([k, name, max, fmt]) => `
    <div class="stat"><span>${name}</span>
      <div class="bar"><i style="width:${Math.min(100, st[k] / max * 100)}%"></i></div>
      <span class="val">${fmt(st[k])}</span></div>`).join('');
}
const dots = (lv, max) => '●'.repeat(lv) + '○'.repeat(max - lv);
const swatches = (colors, act, on, small) => `<div class="swatches ${small ? 'small' : ''}">${colors.map(c =>
  `<button data-act="${act}" data-id="${c}" class="${c === on ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>`;

function fxText(from, to) {
  const out = [];
  const d = (k) => (to[k] || 0) - (from[k] || 0);
  if (d('top')) out.push(`+${Math.round(d('top') * 3.6)} km/h`);
  if (d('accel')) out.push(`bốc +${d('accel').toFixed(1)}`);
  if (d('grip')) out.push(`bám +${d('grip').toFixed(1)}`);
  if (d('brake')) out.push(`phanh +${d('brake').toFixed(1)}`);
  return out.join(', ');
}

function renderGara() {
  const car = getCar(save.carId), parts = cur().parts, lv = totalLevel(parts);
  const classes = CLASSES.map(c =>
    `<span class="tag ${lv <= c.maxLevel ? 'ok' : 'no'}">${c.name}</span>`).join(' ');
  return `
    <h3>${car.name}</h3>
    ${statBars(calcStats(save.carId, parts))}
    <p class="note">Tổng cấp đồ: <b>${lv}</b>. Được chạy: ${classes}</p>
    <p class="note">Đổi màu sơn, dán chữ, biển số, đèn gầm, body kit ở tab <b>Custom</b>.</p>
    <h3>Chọn xe</h3>
    ${CARS.map(b => {
      const own = !!save.owned[b.id], on = b.id === save.carId;
      const btn = on ? '<span class="tag ok">Đang dùng</span>'
        : own ? `<button data-act="pick-car" data-id="${b.id}">Chọn</button>`
        : `<button data-act="buy-car" data-id="${b.id}" ${save.money < b.price ? 'disabled' : ''}>Mua <span class="price">${money(b.price)}</span></button>`;
      return `<div class="item ${on ? 'on' : ''}"><div class="grow"><div class="name">${b.name}</div>
        <div class="sub">${b.desc}</div>
        <div class="sub">${Math.round(b.base.top * 3.6)} km/h · bốc ${b.base.accel.toFixed(1)} · bám ${b.base.grip.toFixed(1)}</div></div>${btn}</div>`;
    }).join('')}
    <h3>Đồ đang gắn</h3>
    <p class="note">Muốn gắn đồ mới, bấm <b>Độ</b> để sang Tiệm đồ rồi bấm <b>Mua</b>. Mua xong đồ tự gắn lên xe.</p>
    ${PARTS.map(p => `<div class="item"><div class="grow"><div class="name">${p.levels[parts[p.id] || 0].name}</div>
      <div class="sub">${p.name} <span class="dots">${dots(parts[p.id] || 0, p.levels.length - 1)}</span></div></div>
      <button data-act="go-shop">Độ</button></div>`).join('')}
    <p class="note">Số trận thắng: <b>${save.wins}</b></p>`;
}

function renderTiem() {
  const parts = cur().parts;
  return `<p class="note">Đang độ cho: <b>${getCar(save.carId).name}</b>. Bán lại đồ được ${SELL_RATE * 100}% giá mua.</p>` +
    PARTS.map(p => {
      const lv = parts[p.id] || 0, now = p.levels[lv], next = p.levels[lv + 1];
      const buy = next
        ? `<button class="primary" data-act="buy-part" data-id="${p.id}" ${save.money < next.price ? 'disabled' : ''}>Mua ${money(next.price)}</button>`
        : '<span class="tag ok">Đã kịch</span>';
      const sell = lv > 0
        ? `<button data-act="sell-part" data-id="${p.id}">Bán +${money(Math.floor(now.price * SELL_RATE))}</button>` : '';
      return `<div class="item"><div class="grow">
        <div class="name">${p.name} <span class="dots">${dots(lv, p.levels.length - 1)}</span></div>
        <div class="sub">Đang gắn: ${now.name}</div>
        ${next ? `<div class="sub">Lên: <b>${next.name}</b> (${fxText(now.fx, next.fx)})</div>` : ''}
        </div><div class="btns">${buy}${sell}</div></div>`;
    }).join('');
}

// Tab Custom: mọi thứ về vẻ ngoài của xe, không ảnh hưởng sức mạnh
function renderCustom() {
  const c = cur(), owned = c.kitOwned || 0;
  const glow = c.glowOwned
    ? `${swatches(GLOW_COLORS, 'glow', c.glow || '', false)}
       <p class="note"><button data-act="glow" data-id="">Tắt đèn gầm</button></p>`
    : `<div class="item"><div class="grow"><div class="name">Đèn gầm LED</div><div class="sub">Lắp một lần, đổi màu thoải mái. Đẹp nhất ở Phố đêm.</div></div>
       <button class="primary" data-act="buy-glow" ${save.money < GLOW_PRICE ? 'disabled' : ''}>Lắp ${money(GLOW_PRICE)}</button></div>`;
  const kits = KITS.map((k, i) => {
    const on = (c.kit || 0) === i;
    const btn = on ? '<span class="tag ok">Đang gắn</span>'
      : i <= owned ? `<button data-act="kit" data-id="${i}">Gắn</button>`
      : `<button class="primary" data-act="buy-kit" data-id="${i}" ${save.money < k.price ? 'disabled' : ''}>Mua ${money(k.price)}</button>`;
    return `<div class="item ${on ? 'on' : ''}"><div class="grow"><div class="name">${k.name}</div><div class="sub">${k.desc}</div></div>${btn}</div>`;
  }).join('');
  return `
    <p class="note">Đang custom: <b>${getCar(save.carId).name}</b>. Các món ở đây chỉ để đẹp, không tính vào tổng cấp đồ.</p>
    <h3>Màu sơn</h3>
    ${swatches(COLORS, 'color', c.color, false)}
    <h3>Chữ dán cửa xe</h3>
    <input class="field" id="car-text" type="text" maxlength="14" placeholder="Tên, biệt danh, đội đua..." value="${esc(c.text || '')}">
    ${swatches(TEXT_COLORS, 'text-color', c.textColor || TEXT_COLORS[0], true)}
    <h3>Biển số riêng</h3>
    <input class="field" id="car-plate" type="text" maxlength="9" placeholder="Ví dụ: 59A-26306" value="${esc(c.plate || '')}">
    <p class="note">Biển số gắn ở đuôi xe. Để trống nếu không muốn gắn.</p>
    <h3>Đèn gầm</h3>
    ${glow}
    <h3>Body kit</h3>
    ${kits}
    <h3>Tay đua</h3>
    <div class="item"><div class="grow"><div class="name">${esc(save.driver ? save.driver.name : '')}</div>
      <div class="sub">Đổi tên, màu da, màu tóc, phụ kiện.</div></div><button data-act="edit-driver">Sửa</button></div>`;
}

function renderGiai() {
  const lv = totalLevel(cur().parts);
  const tracks = Object.entries(TRACKS).map(([id, t]) => {
    const on = id === save.track;
    return `<div class="item ${on ? 'on' : ''}"><div class="grow"><div class="name">${t.name}</div>
      <div class="sub">${t.desc}</div></div>
      ${on ? '<span class="tag ok">Đang chọn</span>' : `<button data-act="track" data-id="${id}">Chọn</button>`}</div>`;
  }).join('');
  const drive = `
    <div class="item"><div class="grow"><div class="name">Hộp số: ${save.manual ? 'số tay' : 'tự động'}</div>
      <div class="sub">Số tay: bấm phím 1 đến 5 để gài số. Gài sai số thì xe ì hoặc bị ghì.</div></div>
      <button data-act="gearbox">${save.manual ? 'Sang tự động' : 'Sang số tay'}</button></div>
    <div class="item"><div class="grow"><div class="name">Trợ lái: ${save.assist ? 'đang bật' : 'đang tắt'}</div>
      <div class="sub">Xe tự phanh trước cua và tự nắn thẳng theo đường. Nên bật khi mới chơi.</div></div>
      <button data-act="assist">${save.assist ? 'Tắt' : 'Bật'}</button></div>`;
  return `<h3>Đường đua</h3>${tracks}<h3>Cách lái</h3>${drive}<h3>Giải đấu</h3>` + CLASSES.map(c => {
    const ok = lv <= c.maxLevel, best = save.best[`${save.track}:${c.id}`];
    const limit = c.maxLevel >= 99 ? 'Không giới hạn đồ' : `Tổng cấp đồ tối đa ${c.maxLevel}`;
    return `<div class="item"><div class="grow">
      <div class="name">${c.name}</div>
      <div class="sub">${c.desc}</div>
      <div class="sub">${c.laps} vòng · ${limit}</div>
      <div class="sub">Thưởng: nhất <span class="price">${money(c.prizes[0])}</span> · nhì <span class="price">${money(c.prizes[1])}</span> · ba <span class="price">${money(c.prizes[2])}</span></div>
      <div class="sub">Thành tích tốt nhất: ${best ? fmtTime(best) : 'chưa có'}</div>
      ${ok ? '' : `<div class="sub"><span class="tag no">Xe đang độ cấp ${lv}, quá mức cho phép</span></div>`}
      </div><button class="primary" data-act="race" data-id="${c.id}" ${ok ? '' : 'disabled'}>Vào đua</button></div>`;
  }).join('') + '<p class="note">Đối thủ đi đủ loại xe nhưng sức mạnh được cân theo xe của bạn. Hơn nhau ở đồ chơi và tay lái.</p>';
}

function renderMissions() {
  const order = (m) => (m.done && !m.claimed ? 0 : m.claimed ? 2 : 1);
  const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(1));
  const ready = missionList().filter(m => m.done && !m.claimed);
  const total = ready.reduce((s, m) => s + m.reward, 0);
  const all = ready.length
    ? `<button class="primary wide" data-act="claim-all">Nhận tất cả ${ready.length} phần thưởng (+${money(total)})</button>`
    : '<button class="wide" disabled>Chưa có phần thưởng nào để nhận</button>';
  return `<p class="note">Làm xong nhiệm vụ thì bấm <b>Nhận</b> để lấy tiền thưởng.</p>${all}<p class="note"></p>` +
    missionList().sort((a, b) => order(a) - order(b)).map(m => {
      const btn = m.claimed ? '<span class="tag">Đã nhận</span>'
        : m.done ? `<button class="primary" data-act="claim" data-id="${m.id}">Nhận ${money(m.reward)}</button>`
        : `<span class="price">${money(m.reward)}</span>`;
      return `<div class="item ${m.done && !m.claimed ? 'on' : ''}"><div class="grow">
        <div class="name">${m.name}</div><div class="sub">${m.desc}</div>
        <div class="stat mission"><div class="bar"><i style="width:${Math.min(100, m.value / m.target * 100)}%"></i></div>
          <span class="val">${fmt(Math.min(m.value, m.target))}/${m.target}</span></div>
        </div>${btn}</div>`;
    }).join('');
}

function renderGuide() {
  return `
    <h3>Mục tiêu</h3>
    <p class="guide">Đua kiếm tiền, lấy tiền mua đồ độ xe cho mạnh hơn, rồi lên giải lớn hơn và mua xe xịn hơn.</p>
    <h3>Chơi theo 3 bước</h3>
    <ol class="guide">
      <li><b>Giải đua</b>: chọn đường đua, bấm <b>Vào đua</b> ở Giải Xe Zin để kiếm tiền đầu tiên. Về hạng nào cũng có thưởng, càng cao thưởng càng lớn.</li>
      <li><b>Tiệm đồ</b>: bấm <b>Mua</b> ở món muốn nâng. Đồ tự gắn lên xe ngay, mỗi món có 3 cấp. Bấm <b>Bán</b> để tháo ra và lấy lại nửa tiền.</li>
      <li><b>Gara</b> và <b>Custom</b>: xem chỉ số, mua và đổi xe; đổi màu sơn, dán chữ, biển số, đèn gầm, body kit.</li>
    </ol>
    <p class="guide">Tab <b>Nhiệm vụ</b> có các mục tiêu nhỏ, làm xong bấm <b>Nhận</b> để lấy thêm tiền. Có một nhiệm vụ làm lại được mỗi ngày.</p>
    <h3>Điều khiển</h3>
    <ul class="guide">
      <li><b>W</b>: ga · <b>S</b> hoặc <b>phím cách</b>: phanh</li>
      <li><b>A</b>, <b>D</b>: đánh lái trái, phải</li>
      <li><b>M</b> (giữ): bơm nitro để tăng tốc. Bình nitro tự nạp lại khi không dùng.</li>
      <li><b>G</b>: đổi giữa hộp số tay và tự động ngay trong lúc đua</li>
      <li><b>1 2 3 4 5</b>: gài số, khi chọn hộp số tay. Hộp số mini ở góc dưới bên trái cho biết đang ở số nào.</li>
      <li><b>R</b>: đưa xe về giữa đường khi bị kẹt</li>
      <li><b>Esc</b> hoặc <b>P</b>: tạm dừng, mở menu</li>
      <li>Nút <b>♪ Nhạc</b> ở góc trên bật tắt nhạc nền, thanh trượt bên cạnh chỉnh âm lượng. Trong lúc đua thì bật tắt ở menu tạm dừng.</li>
      <li>Các phím mũi tên vẫn dùng được thay cho W A S D.</li>
      <li>Điện thoại: dùng các nút tròn hiện trên màn hình</li>
    </ul>
    <h3>Hộp số</h3>
    <p class="guide"><b>Tự động</b>: xe tự lên xuống số, bạn không cần làm gì. <b>Số tay</b>: bạn tự gài bằng phím 1 đến 5. Số thấp kéo mạnh nhưng nhanh hết lực, số cao chạy nhanh nhưng đề yếu. Nhìn thanh vòng tua cạnh đồng hồ tốc độ: gần đầy thì lên số. Gài số cao lúc xe còn chậm thì xe ì; về số thấp lúc đang nhanh thì máy ghì xe lại.</p>
    <h3>Trợ lái</h3>
    <p class="guide">Khi bật <b>Trợ lái</b> (mặc định), xe tự nhả ga và tự phanh trước cua, và tự nắn thẳng theo đường khi bạn không bấm lái. Tắt trong tab Giải đua hoặc menu tạm dừng nếu muốn tự làm hết và chạy nhanh hơn.</p>
    <h3>Tai nạn</h3>
    <p class="guide">Tông mạnh vào đuôi xe khác là tai nạn: xe <b>bị tông</b> sẽ chớp chớp vài giây rồi chạy tiếp. Xe nào bị tông quá <b>${MAX_HITS} lần</b> thì bị loại khỏi cuộc đua, kể cả bạn nếu bị xe sau tông. Người tông cũng mất tốc độ, nên lách sang bên để vượt vẫn nhanh hơn.</p>
    <h3>Món đồ nào làm gì</h3>
    <ul class="guide">
      <li><b>Pô, Động cơ</b>: tăng tốc độ tối đa, chạy nhanh hơn ở đoạn thẳng</li>
      <li><b>Hộp số</b>: tăng độ bốc, thoát cua nhanh hơn</li>
      <li><b>Lốp, Phuộc, Cánh gió</b>: tăng độ bám, vào cua nhanh hơn mà không trượt</li>
      <li><b>Phanh</b>: phanh gấp hơn, được phanh muộn hơn trước cua</li>
    </ul>
    <h3>Luật các giải</h3>
    <ul class="guide">
      ${CLASSES.map(c => `<li><b>${c.name}</b>: ${c.maxLevel >= 99 ? 'không giới hạn đồ' : `tổng cấp đồ tối đa ${c.maxLevel}`}, ${c.laps} vòng, thưởng ${money(c.prizes[0])} / ${money(c.prizes[1])} / ${money(c.prizes[2])} cho ba hạng đầu</li>`).join('')}
    </ul>
    <p class="guide">Tổng cấp đồ là tổng số chấm cam ● của tất cả món đang gắn. Độ quá mức thì phải bán bớt đồ mới được vào giải thấp.</p>
    <h3>Đường đất</h3>
    <p class="guide">Ở đường <b>Đồi Xoáy</b>, xe gầm thấp bị giảm tốc độ, độ bốc và độ bám. <b>Bán tải Raptor</b> không bị giảm, SUV bị giảm ít. Lên dốc xe chậm lại, xuống dốc trôi nhanh hơn.</p>`;
}

// Màn tạo nhân vật: hiện lần đầu vào game, hoặc khi bấm Sửa trong tab Custom
function renderCreator() {
  return `
    <h3>Tạo tay đua của bạn</h3>
    <p class="note">Tay đua đứng cạnh xe trong gara và lên bục nhận giải khi về top 3.</p>
    <h3>Tên</h3>
    <input class="field" id="drv-name" type="text" maxlength="14" placeholder="Nhập tên tay đua" value="${esc(draft.name)}">
    <h3>Màu da</h3>
    ${swatches(SKINS, 'drv-skin', draft.skin, false)}
    <h3>Màu tóc</h3>
    ${swatches(HAIRS, 'drv-hair', draft.hair, false)}
    <h3>Màu áo đua</h3>
    ${swatches(SUITS, 'drv-suit', draft.suit, false)}
    <h3>Họa tiết đồ đua</h3>
    <div class="chips">${PATTERNS.map(p =>
      `<button data-act="drv-pattern" data-id="${p.id}" class="${p.id === (draft.pattern || 'none') ? 'on' : ''}">${p.name}</button>`).join('')}</div>
    ${Object.entries(ACCESSORIES).map(([slot, group]) => `
      <h3>Phụ kiện: ${group.name}</h3>
      <div class="chips">${group.items.map(a =>
        `<button data-act="drv-acc" data-slot="${slot}" data-id="${a.id}" class="${a.id === (draft[slot] || 'none') ? 'on' : ''}">${a.name}</button>`).join('')}</div>`).join('')}
    ${draft.hat === 'helmet' ? '<p class="note">Nón bảo hiểm che kín mặt nên phụ kiện trên mặt sẽ không hiện.</p>' : ''}
    <p class="note"></p>
    <button class="primary wide" data-act="drv-done">${save.driver ? 'Lưu' : 'Vào game'}</button>`;
}

function openCreator() {
  draft = { name: '', skin: SKINS[1], hair: HAIRS[0], suit: SUITS[0], pattern: 'flame', hat: 'none', face: 'none', neck: 'none', ...(save.driver || {}) };
  // Bản lưu cũ chỉ có một phụ kiện (acc): chuyển sang nhóm tương ứng
  if (draft.acc) {
    for (const slot of ['hat', 'face']) if (ACCESSORIES[slot].items.some(a => a.id === draft.acc)) draft[slot] = draft.acc;
    delete draft.acc;
  }
  mode = 'creator';
  $('tabs').hidden = true;
  applyView();
  refreshGarage();
  render();
}

function render() {
  $('money').textContent = money(save.money);
  if (mode === 'creator') { $('content').innerHTML = renderCreator(); return; }
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const n = claimable();
  $('tab-nv').textContent = n ? `Nhiệm vụ (${n})` : 'Nhiệm vụ';
  const views = { gara: renderGara, tiem: renderTiem, custom: renderCustom, giai: renderGiai, nhiemvu: renderMissions, huongdan: renderGuide };
  $('content').innerHTML = views[tab]();
}

$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) { tab = b.dataset.tab; render(); $('content').scrollTop = 0; }
});

$('content').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b || b.disabled) return;
  const id = b.dataset.id, c = cur(), parts = c.parts;
  let sound = '', coins = 1; // tiếng phát ra sau thao tác: 'upgrade', 'sell', 'paint', 'buy', 'coin'; coins = số đồng xu kêu
  switch (b.dataset.act) {
    // Tạo nhân vật
    case 'drv-skin': draft.skin = id; break;
    case 'drv-hair': draft.hair = id; break;
    case 'drv-suit': draft.suit = id; break;
    case 'drv-pattern': draft.pattern = id; break;
    case 'drv-acc': draft[b.dataset.slot] = id; break;
    case 'drv-done': {
      draft.name = ($('drv-name').value || '').trim() || 'Tay đua';
      const first = !save.driver;
      save.driver = draft;
      mode = 'garage';
      $('tabs').hidden = false;
      if (first) tab = 'huongdan'; // lần đầu thì đọc hướng dẫn trước
      applyView();
      break;
    }
    case 'edit-driver': openCreator(); return;
    // Gara, tiệm đồ
    case 'go-shop': tab = 'tiem'; render(); $('content').scrollTop = 0; return;
    case 'pick-car': save.carId = id; break;
    case 'buy-car': {
      const car = getCar(id);
      if (save.money < car.price) return;
      save.money -= car.price;
      save.owned[id] = { parts: emptyParts(), color: COLORS[0] };
      save.carId = id;
      sound = 'buy';
      break;
    }
    case 'buy-part': {
      const next = PARTS.find(p => p.id === id).levels[(parts[id] || 0) + 1];
      if (!next || save.money < next.price) return;
      save.money -= next.price;
      parts[id] = (parts[id] || 0) + 1;
      save.stats.partsBought = (save.stats.partsBought || 0) + 1;
      sound = 'upgrade';
      break;
    }
    case 'sell-part': {
      const lv = parts[id] || 0;
      if (lv < 1) return;
      save.money += Math.floor(PARTS.find(p => p.id === id).levels[lv].price * SELL_RATE);
      parts[id] = lv - 1;
      sound = 'sell';
      break;
    }
    // Custom
    case 'color': c.color = id; sound = 'paint'; break;
    case 'text-color': c.textColor = id; break;
    case 'buy-glow':
      if (save.money < GLOW_PRICE) return;
      save.money -= GLOW_PRICE; c.glowOwned = true; c.glow = GLOW_COLORS[0];
      sound = 'upgrade';
      break;
    case 'glow': c.glow = id; break;
    case 'buy-kit': {
      const k = Number(id);
      if (save.money < KITS[k].price) return;
      save.money -= KITS[k].price; c.kitOwned = Math.max(c.kitOwned || 0, k); c.kit = k;
      sound = 'upgrade';
      break;
    }
    case 'kit': c.kit = Number(id); sound = 'upgrade'; break;
    // Giải đua, nhiệm vụ
    case 'track': save.track = id; break;
    case 'assist': save.assist = !save.assist; break;
    case 'gearbox': save.manual = !save.manual; break;
    case 'claim': {
      const m = missionList().find(x => x.id === id);
      if (!m || !m.done || m.claimed) return;
      save.money += m.reward;
      if (id === DAILY.id) daily().claimed = true; else save.claimed[id] = true;
      sound = 'coin';
      break;
    }
    case 'claim-all':
      for (const m of missionList()) {
        if (!m.done || m.claimed) continue;
        save.money += m.reward;
        if (m.id === DAILY.id) daily().claimed = true; else save.claimed[m.id] = true;
        coins++;
      }
      sound = 'coin';
      break;
    case 'race': startRace(id); return;
  }
  persist();
  // Tiếng riêng cho từng thao tác: cơ khí khi độ xe, xịt sơn khi đổi màu, tiền khi nhận thưởng
  if (sound) music.sfx(sound, sound === 'coin' ? Math.max(1, coins - 1) : 1);
  refreshGarage();
  // Giữ nguyên chữ đang gõ dở trong ô tên khi bấm chọn màu ở màn tạo nhân vật
  if (mode === 'creator' && $('drv-name')) draft.name = $('drv-name').value;
  render();
});

// Gõ chữ: cập nhật xe ngay nhưng không vẽ lại bảng, để ô nhập không mất con trỏ
$('content').addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'car-text') cur().text = t.value;
  else if (t.id === 'car-plate') cur().plate = t.value = t.value.toUpperCase();
  else if (t.id === 'drv-name') { draft.name = t.value; return; }
  else return;
  persist();
  refreshGarage();
});

// ---------- Điều khiển ----------
// gear: số vừa bấm (1..5), dùng một lần rồi xóa. boost: đang giữ phím nitro.
const input = { left: false, right: false, gas: false, brake: false, boost: false, reset: false, gear: 0 };
const KEYS = {
  KeyA: 'left', KeyD: 'right', KeyW: 'gas', KeyS: 'brake', Space: 'brake', KeyM: 'boost',
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'gas', ArrowDown: 'brake',
};
window.addEventListener('keydown', (e) => {
  if (mode !== 'race') return;
  if (KEYS[e.code]) { input[KEYS[e.code]] = true; e.preventDefault(); }
  if (e.code === 'KeyR') input.reset = true;
  const m = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
  if (m) input.gear = Number(m[1]);
});
window.addEventListener('keyup', (e) => { if (KEYS[e.code]) input[KEYS[e.code]] = false; });

document.querySelectorAll('#touch button[data-key]').forEach(b => {
  const set = (on) => (e) => { e.preventDefault(); input[b.dataset.key] = on; b.classList.toggle('down', on); };
  b.addEventListener('pointerdown', set(true));
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false));
});
// Nút lên, xuống số trên điện thoại
document.querySelectorAll('#touch button[data-shift]').forEach(b => {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.gear = Math.max(1, Math.min(5, race.player.gear + Number(b.dataset.shift)));
  });
});

// ---------- Vào đua ----------
let lastClass = null, lastRivals = [];

function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

function startRace(classId) {
  const cls = CLASSES.find(c => c.id === classId);
  lastClass = classId;
  const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
  const names = shuffle(AI_NAMES), bodies = shuffle(CARS.map(c => c.body));
  const colors = shuffle(COLORS.filter(c => c !== cur().color));
  const night = TRACKS[save.track].theme === 'city';
  // Đối thủ đầu đoàn mạnh nhất, yếu dần về sau. Mỗi người một kiểu xe, một màu.
  const rivals = lastRivals = [0, 1, 2, 3, 4].map(i => {
    const frac = cls.ai[1] - (cls.ai[1] - cls.ai[0]) * (i / 4);
    return {
      name: names[i], stats: aiStats(save.carId, frac), skill: 0.76 - 0.04 * i,
      body: bodies[i], color: colors[i], po: Math.round(frac * 3), wing: Math.round(frac * 3), text: names[i],
      kit: Math.round(frac * 2), glow: night ? GLOW_COLORS[i] : '',
    };
  });
  for (const k in input) input[k] = k === 'gear' ? 0 : false;
  mode = 'race';
  paused = false;
  $('ui').hidden = true; $('result').hidden = true; $('pause').hidden = true; $('hud').hidden = false;
  $('touch').hidden = !isTouch;
  gearLabels();
  race = getRace(save.track);
  race.start({
    ...carLook(), stats: calcStats(save.carId, cur().parts),
    laps: cls.laps, rivals, assist: save.assist, manual: save.manual,
  }, (res) => onFinish(cls, res));
  buildMinimap();
  engine.start();
  music.setStyle('race');
}

function onFinish(cls, res) {
  const prize = res.out ? 0 : (cls.prizes[res.rank - 1] || 0);
  const key = `${save.track}:${cls.id}`, old = save.best[key];
  const record = !res.out && (!old || res.time < old);
  save.money += prize;
  if (record) save.best[key] = res.time;
  // Cộng dồn các con số dùng cho nhiệm vụ
  const st = save.stats, add = (k, n = 1) => { st[k] = (st[k] || 0) + n; };
  add('distKm', res.distKm);
  st.topKmh = Math.max(st.topKmh || 0, res.maxKmh);
  if (!res.out) {
    add('races'); daily().races++;
    if (res.rank <= 3) add('podiums');
    if (res.wallHits === 0) add('cleanRaces');
    if (res.rank === 1) {
      save.wins++; add('wins');
      if (save.track === 'city') add('cityWins');
      if (save.track === 'hills') add('dirtWins');
      if (cls.id === 'full') add('fullWins');
    }
  }
  persist();
  setTimeout(() => { if (mode === 'race') showPodium(cls, res, prize, record); }, 1400);
}

// Lễ trao giải: ba tay đua về đầu lên bục, bảng kết quả ghi danh hiệu và tiền thưởng giảm dần
function showPodium(cls, res, prize, record) {
  race.stop();
  engine.stop();
  const me = save.driver ? save.driver.name : 'Bạn';
  const racers = res.standings.map(s => {
    if (s.name === null) return { name: me, look: save.driver || {}, suit: (save.driver && save.driver.suit) || SUITS[0], me: true, out: s.out };
    const r = lastRivals.find(x => x.name === s.name);
    return { name: s.name, look: lookOf(s.name), suit: r ? r.color : '#888888', out: s.out };
  });
  mode = 'podium';
  music.setStyle('win');
  $('hud').hidden = true; $('touch').hidden = true;
  buildPodium(racers.filter(r => !r.out));
  applyView();

  const rows = racers.slice(0, 3).map((r, k) => r.out ? '' : `
    <div class="place p${k + 1} ${r.me ? 'me' : ''}"><span class="medal">${k + 1}</span>
      <span class="grow"><b>${esc(r.name)}</b><small>${TITLES[k]}</small></span>
      <span class="price">${money(cls.prizes[k])}</span></div>`).join('');
  const mine = res.out
    ? `Bạn bị <b>loại</b> vì bị tông quá ${MAX_HITS} lần. Không có tiền thưởng.`
    : res.rank <= 3 ? `Bạn giành danh hiệu <b>${TITLES[res.rank - 1]}</b>, thưởng <b>${money(prize)}</b>.`
    : `Bạn về hạng <b>${res.rank}/${res.total}</b>, thưởng khuyến khích <b>${money(prize)}</b>.`;
  const ready = claimable();
  $('r-title').textContent = res.out ? 'BỊ LOẠI' : res.rank === 1 ? 'VÔ ĐỊCH!' : `Hạng ${res.rank} / ${res.total}`;
  $('r-body').innerHTML = `<div class="sub">${cls.name} · ${TRACKS[save.track].name}</div>${rows}
    <p>${mine}</p>
    <p class="small">Thời gian <b>${fmtTime(res.time)}</b>${record ? ' (kỷ lục mới)' : ''} · Cao nhất <b>${res.maxKmh} km/h</b> ·
      Chạm tường <b>${res.wallHits}</b> · Tông xe khác <b>${res.crashes}</b></p>
    ${ready ? `<p class="small"><b>Có ${ready} nhiệm vụ chờ nhận thưởng</b> trong tab Nhiệm vụ.</p>` : ''}`;
  $('result').hidden = false;
  if (prize > 0) music.sfx('coin', res.rank <= 3 ? 4 - res.rank : 1); // vô địch 3 đồng, á quân 2, hạng ba 1
}

// Tiếng "tích" khi bấm bất kỳ nút nào. Nút đã có tiếng riêng (độ xe, đổi màu, nhận thưởng...)
// và nút ga phanh trên điện thoại thì không kêu thêm.
const OWN_SOUND = new Set(['buy-car', 'buy-part', 'sell-part', 'color', 'buy-glow', 'buy-kit', 'kit', 'claim', 'claim-all']);
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled || b.closest('#touch') || OWN_SOUND.has(b.dataset.act)) return;
  music.sfx('click');
});

function backToGarage() {
  music.setStyle('menu');
  music.duck(false);
  race.stop();
  engine.stop();
  mode = 'garage';
  paused = false;
  $('ui').hidden = false; $('hud').hidden = true; $('touch').hidden = true; $('result').hidden = true; $('pause').hidden = true;
  applyView();
  refreshGarage();
  render();
}
$('r-back').addEventListener('click', backToGarage);
$('r-again').addEventListener('click', () => startRace(lastClass));

// ---------- Tạm dừng và menu trong lúc đua ----------
let paused = false;

function pauseLabels() {
  $('p-gear').textContent = `Hộp số: ${save.manual ? 'số tay' : 'tự động'}`;
  $('p-assist').textContent = `Trợ lái: ${save.assist ? 'bật' : 'tắt'}`;
  $('p-sound').textContent = `Tiếng máy: ${engine.on ? 'bật' : 'tắt'}`;
  $('p-music').textContent = `Nhạc nền: ${music.on ? 'bật' : 'tắt'}`;
}
function setPaused(on) {
  if (mode !== 'race' || !$('result').hidden) return;
  paused = on;
  for (const k in input) input[k] = k === 'gear' ? 0 : false;
  $('pause').hidden = !on;
  music.duck(on);
  if (on) { engine.stop(); pauseLabels(); }
}
$('p-music').addEventListener('click', () => { toggleMusic(); pauseLabels(); });
$('h-pause').addEventListener('click', () => setPaused(true));
$('p-resume').addEventListener('click', () => setPaused(false));
$('p-restart').addEventListener('click', () => startRace(lastClass));
$('p-quit').addEventListener('click', backToGarage);
$('p-sound').addEventListener('click', () => {
  engine.toggle();
  engine.stop(); // đang tạm dừng nên chưa phát tiếng lại
  pauseLabels();
});
$('p-assist').addEventListener('click', () => {
  save.assist = !save.assist;
  persist();
  race.assistProf = save.assist ? race.speedProfile(race.player.st, 0.9) : null;
  pauseLabels();
});
// Đổi giữa số tay và số tự động: nút trên màn hình đua, phím G, hoặc menu tạm dừng
function gearLabels() {
  $('h-gearmode').textContent = `Hộp số: ${save.manual ? 'SỐ TAY' : 'TỰ ĐỘNG'} (G)`;
  $('h-shifter').hidden = !save.manual;
  $('t-gears').hidden = !save.manual;
  pauseLabels();
}
function toggleGearbox() {
  save.manual = !save.manual;
  persist();
  race.manual = save.manual;
  gearLabels();
}
$('p-gear').addEventListener('click', toggleGearbox);
$('h-gearmode').addEventListener('click', toggleGearbox);
window.addEventListener('keydown', (e) => {
  if (mode !== 'race') return;
  if (e.code === 'Escape' || e.code === 'KeyP') setPaused(!paused);
  if (e.code === 'KeyG' && !e.repeat) toggleGearbox();
});
// Chuyển sang cửa sổ khác thì tự tạm dừng
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

// ---------- Bản đồ nhỏ ----------
const mapCv = $('h-map'), mapCtx = mapCv.getContext('2d');
let mapFn = null, mapBg = null;

function buildMinimap() {
  const xs = race.pts.map(p => p.x), zs = race.pts.map(p => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const S = mapCv.width, pad = 12, k = (S - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
  // Lật trục x để bản đồ khớp với hướng nhìn từ trên xuống
  mapFn = (x, z) => [S - pad - (x - minX) * k, S - pad - (z - minZ) * k];
  mapBg = document.createElement('canvas');
  mapBg.width = mapBg.height = S;
  const c = mapBg.getContext('2d');
  c.lineJoin = 'round';
  c.beginPath();
  race.pts.forEach((p, i) => { const [x, y] = mapFn(p.x, p.z); i ? c.lineTo(x, y) : c.moveTo(x, y); });
  c.closePath();
  c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 9; c.stroke();
  c.strokeStyle = '#f2f2f2'; c.lineWidth = 4; c.stroke();
}

function drawMinimap() {
  if (!mapBg) return;
  mapCtx.clearRect(0, 0, mapCv.width, mapCv.height);
  mapCtx.drawImage(mapBg, 0, 0);
  const dot = (x, z, color, r) => {
    const [px, py] = mapFn(x, z);
    mapCtx.beginPath(); mapCtx.arc(px, py, r, 0, 7); mapCtx.fillStyle = color; mapCtx.fill();
    mapCtx.lineWidth = 1.5; mapCtx.strokeStyle = '#000'; mapCtx.stroke();
  };
  race.ai.forEach(a => { if (!a.out) dot(a.x, a.z, a.color, 4.5); });
  dot(race.player.x, race.player.z, '#ff7a1a', 6.5);
}

const shifterDots = document.querySelectorAll('#h-shifter i[data-g]');

function drawHud() {
  const h = race.hud;
  $('h-pos').textContent = h.pos;
  $('h-total').textContent = '/' + h.total;
  $('h-lap').textContent = `${h.lap}/${h.laps}`;
  $('h-time').textContent = fmtTime(h.time);
  $('h-kmh').textContent = h.kmh;
  $('h-gear').textContent = (h.manual ? 'M' : 'D') + h.gear;
  $('h-rpm').style.width = Math.round(h.rpm * 100) + '%';
  $('h-rpm').classList.toggle('red', h.rpm > 0.9);
  $('h-nitro').style.width = Math.round(h.nitro * 100) + '%';
  $('h-nitro').classList.toggle('on', h.boosting);
  $('h-hits').textContent = `Bị tông ${h.hits}/${MAX_HITS}`;
  $('h-hits').classList.toggle('warn', h.hits >= MAX_HITS);
  $('h-count').textContent = h.countdown > 0 ? h.countdown : h.countdown === 0 ? 'ĐI!' : '';
  $('h-off').hidden = !h.offTrack;
  $('h-auto').hidden = !h.autoBrake;
  $('h-msg').textContent = h.message;
  if (h.manual) for (const el of shifterDots) el.classList.toggle('on', Number(el.dataset.g) === h.gear);
  drawMinimap();
  engine.update(h.rpm, h.gear, h.gas, h.boosting);
}

// ---------- Vòng lặp chính ----------
let last = performance.now(), smoothDt = 1 / 60;

// Tự giảm chất lượng hình khi máy chạy không nổi: nếu khung hình chậm kéo dài thì
// lần 1 giảm độ nét, lần 2 giảm chất lượng bóng đổ. Mỗi lần giảm xong đo lại từ đầu.
let quality = 2, slowSum = 0, slowCount = 0;
function adaptQuality(frameMs) {
  if (quality === 0) return;
  slowSum += frameMs; slowCount++;
  if (slowCount < 120) return;
  const avg = slowSum / slowCount;
  slowSum = slowCount = 0;
  if (avg < 24) return; // trên khoảng 40 khung hình/giây là đủ mượt
  quality--;
  if (quality === 1) {
    renderer.setPixelRatio(1);
    resize();
  } else {
    renderer.shadowMap.type = THREE.PCFShadowMap;
    for (const r of Object.values(races)) {
      r.sun.shadow.mapSize.set(1024, 1024);
      if (r.sun.shadow.map) { r.sun.shadow.map.dispose(); r.sun.shadow.map = null; }
    }
  }
}

function frame(now) {
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  // Làm mượt bước thời gian: khung hình đến không đều thì xe không bị giật cục theo
  smoothDt += (raw - smoothDt) * 0.25;
  const dt = smoothDt;
  if (mode === 'race') {
    if (!paused) {
      adaptQuality(raw * 1000);
      race.update(dt, input);
      input.reset = false; input.gear = 0;
      drawHud();
    }
    renderer.render(race.scene, race.camera);
  } else {
    if (mode !== 'podium') turntable.rotation.y += dt * 0.4;
    renderer.render(garage, garageCam);
  }
  requestAnimationFrame(frame);
}

resize();
$('content').innerHTML = '<p class="note">Đang tải xe...</p>';
try {
  await loadCars();
} catch (err) {
  $('content').innerHTML = '<p class="note">Không tải được mô hình xe. Kiểm tra thư mục assets/cars/OBJ.</p>';
  throw err;
}
// Lần đầu vào game: đặt tên và tạo nhân vật trước
if (!save.driver) openCreator();
else { refreshGarage(); render(); }
// Cửa nhỏ để thử nghiệm từ bảng điều khiển của trình duyệt (F12): gõ game.race, game.save
window.game = { save, music, get race() { return race; } };
requestAnimationFrame(frame);
