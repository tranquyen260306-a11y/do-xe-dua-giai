// Mô hình xe hơi. Xe con lấy từ bộ "Realistic Car Pack" của Quaternius (giấy phép CC0), nằm trong assets/cars/OBJ.
// Riêng xe bán tải ('Pickup') được dựng bằng code vì bộ mô hình không có. Xe quay đầu về hướng +z.
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const SCALE = 1.1;

// deck = độ cao chỗ gắn cánh gió, rear = vị trí đuôi xe, w = bề rộng cánh gió (đo trên mô hình gốc)
export const MODELS = {
  NormalCar2: { deck: 0.80, rear: -1.63, w: 1.40 },
  NormalCar1: { deck: 0.84, rear: -2.11, w: 1.55 },
  Taxi:       { deck: 0.82, rear: -2.01, w: 1.55 },
  Cop:        { deck: 0.84, rear: -1.87, w: 1.50 },
  SUV:        { deck: 1.52, rear: -2.08, w: 1.70 },
  SportsCar:  { deck: 0.82, rear: -1.97, w: 1.55 },
  SportsCar2: { deck: 0.93, rear: -2.03, w: 1.55 },
  Pickup:     { deck: 1.19, rear: -2.50, w: 1.70 },
};
// Kích thước xe bán tải: len = dài, w = rộng, gc = khoảng sáng gầm, hood = cao nắp máy, belt = cao chân kính,
// roof = cao nóc, wr = bán kính bánh, wb = khoảng cách 2 trục, cab = 4 mốc của khoang kính từ đuôi lên đầu
const TRUCK = { len: 4.9, w: 1.85, gc: 0.40, hood: 1.05, belt: 1.12, roof: 1.80, wr: 0.43, wb: 3.05, cab: [-0.5, -0.38, 0.55, 1.15] };

const std = (o) => new THREE.MeshStandardMaterial(o);
const darkMat = std({ color: 0x141518, roughness: 0.6, metalness: 0.3 });
const tyreMat = std({ color: 0x0e0e0f, roughness: 0.9 });
const rimMat = std({ color: 0xcfd3d9, roughness: 0.25, metalness: 0.9 });
const glassMat = std({ color: 0x0c1016, roughness: 0.06, metalness: 0.9 });
const headMat = std({ color: 0xffffff, emissive: 0xfff2c4, emissiveIntensity: 0.9 });
const tailMat = std({ color: 0xb00000, emissive: 0xff1a1a, emissiveIntensity: 0.8 });
// Tên vật liệu trong file gốc -> vật liệu trong game. Tên nào không có ở đây là màu sơn.
const BODY_MATS = {
  Windows: glassMat, Black: darkMat, Headlights: headMat, TailLights: tailMat,
  Grey: std({ color: 0x4a4e55, roughness: 0.4, metalness: 0.7 }),
  WhiteLights: std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }),
  BlueLights: std({ color: 0x1040c0, emissive: 0x2060ff, emissiveIntensity: 0.8 }),
};
const WHEEL_MATS = { Black: tyreMat, Grey: rimMat };
const pipeMats = [0x55585c, 0xb9bec6, 0xe2e5ea, 0x6fb1ea].map(c => std({ color: c, roughness: 0.3, metalness: 0.9 }));
const flameMat = new THREE.MeshBasicMaterial({ color: 0x4fb4ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });

const cache = {};

// Tải sẵn tất cả mẫu xe một lần lúc mở game
export async function loadCars() {
  const loader = new OBJLoader();
  await Promise.all(Object.keys(MODELS).filter(n => n !== 'Pickup').map(async (name) => {
    const obj = await loader.loadAsync(`assets/cars/OBJ/${name}.obj`);
    const tpl = { body: [], wheels: [], doorX: 0, rearZ: 0, frontZ: 0, gc: 1 };
    obj.traverse((m) => {
      if (!m.isMesh) return;
      const names = (Array.isArray(m.material) ? m.material : [m.material]).map(x => x.name);
      const geo = m.geometry, multi = Array.isArray(m.material);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      if (/Wheel/.test(m.name)) {
        // Dời tâm bánh về gốc tọa độ để bánh quay và đánh lái quanh đúng trục của nó
        geo.computeBoundingBox();
        const c = geo.boundingBox.getCenter(new THREE.Vector3());
        const radius = (geo.boundingBox.max.y - geo.boundingBox.min.y) / 2;
        geo.translate(-c.x, -c.y, -c.z);
        tpl.wheels.push({ geo, names, multi, center: c, radius, front: /Front/.test(m.name) });
      } else {
        tpl.body.push({ geo, names, multi });
        // Đo thân xe để biết chỗ dán chữ, gắn biển số, body kit
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = Math.abs(pos.getX(i)), y = pos.getY(i), z = pos.getZ(i);
          if (y > 0.4 && y < 0.72 && Math.abs(z) < 0.5) tpl.doorX = Math.max(tpl.doorX, x);
          if (y > 0.3 && y < 0.6) { tpl.rearZ = Math.min(tpl.rearZ, z); tpl.frontZ = Math.max(tpl.frontZ, z); }
          tpl.gc = Math.min(tpl.gc, y);
        }
      }
    });
    cache[name] = tpl;
  }));
}

// Ảnh chữ để dán lên xe. plate = true thì vẽ kiểu biển số nền trắng viền đen.
const textCache = new Map();
function textTexture(text, color, plate) {
  const key = `${text}|${color}|${plate}`;
  if (textCache.has(key)) return textCache.get(key);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  if (plate) {
    ctx.fillStyle = '#f4f4f0'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 118);
  }
  // Thu nhỏ cỡ chữ cho tới khi vừa bề ngang
  let size = 96;
  do { ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`; size -= 4; }
  while (ctx.measureText(text).width > 470 && size > 20);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = plate ? '#111' : color;
  if (!plate) { ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(text, 256, 68); }
  ctx.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  textCache.set(key, t);
  return t;
}

let glowTexture = null;
function glowTex() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return (glowTexture = new THREE.CanvasTexture(c));
}

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function wheelRig(center, front) {
  const steer = new THREE.Group(), spin = new THREE.Group();
  steer.position.copy(center);
  steer.add(spin);
  return { steer, spin, front };
}

// Ráp xe từ mô hình có sẵn. Trả về kích thước để gắn đồ và danh sách bánh.
function buildFromModel(car, tpl, pick) {
  for (const p of tpl.body) car.add(new THREE.Mesh(p.geo, pick(BODY_MATS, p)));
  const wheels = tpl.wheels.map((w) => {
    const rig = wheelRig(w.center, w.front);
    rig.spin.add(new THREE.Mesh(w.geo, pick(WHEEL_MATS, w)));
    car.add(rig.steer);
    return { ...rig, radius: w.radius, z: w.center.z };
  });
  const zs = wheels.map(w => w.z);
  return { wheels, dims: {
    doorX: tpl.doorX, rearZ: tpl.rearZ, frontZ: tpl.frontZ, gc: tpl.gc, wb: Math.max(...zs) - Math.min(...zs),
    doorY: 0.57, doorZ: -0.05, plateY: 0.45,
  } };
}

// Ép một hình nhìn ngang (trục ngang = chiều dài xe, trục dọc = chiều cao) thành khối rộng `width`, bo mép `bevel`
function extrude(shape, width, bevel) {
  const depth = width - bevel * 2;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}
function poly(points) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}

// Dựng xe bán tải gầm cao: thân, khoang lái, thùng sau, khung thể thao có dàn đèn, vè bánh, bậc lên xuống
function buildPickup(car, paint) {
  const b = TRUCK, h = b.len / 2, R = b.wr + 0.08, zr = -b.wb / 2, zf = b.wb / 2;
  const s = new THREE.Shape();
  s.moveTo(-h + 0.08, b.gc + 0.1);
  s.lineTo(zr - R, b.gc); s.absarc(zr, b.wr, R, Math.PI, 0, true); s.lineTo(zr + R, b.gc);
  s.lineTo(zf - R, b.gc); s.absarc(zf, b.wr, R, Math.PI, 0, true); s.lineTo(zf + R, b.gc);
  s.lineTo(h - 0.1, b.gc + 0.08); s.lineTo(h, b.gc + 0.3); s.lineTo(h, b.hood - 0.1); s.lineTo(h - 0.25, b.hood);
  s.lineTo(b.cab[3], b.belt); s.lineTo(b.cab[0], b.belt); s.lineTo(-h + 0.05, b.belt); s.lineTo(-h, b.belt - 0.15);
  car.add(new THREE.Mesh(extrude(s, b.w, 0.05), paint));

  const [c0, c1, c2, c3] = b.cab;
  car.add(new THREE.Mesh(extrude(poly([[c0, b.belt - 0.02], [c1, b.roof - 0.04], [c2, b.roof - 0.04], [c3, b.belt - 0.02]]), b.w * 0.88, 0.03), glassMat));
  car.add(new THREE.Mesh(extrude(poly([[c1 - 0.02, b.roof - 0.06], [c1 + 0.06, b.roof], [c2 - 0.06, b.roof], [c2 + 0.02, b.roof - 0.06]]), b.w * 0.85, 0.02), paint));
  car.add(box(b.w * 0.895, b.roof - b.belt, 0.1, paint, 0, (b.roof + b.belt) / 2, (c1 + c2) / 2 - 0.08)); // trụ giữa
  car.add(box(b.w * 0.8, 0.03, h + c0 - 0.3, darkMat, 0, b.belt + 0.045, (c0 - h) / 2 - 0.02));          // lòng thùng

  // Khung thể thao sau cabin, có dàn đèn
  const zb = c0 - 0.28;
  for (const sx of [-1, 1]) car.add(box(0.08, 0.58, 0.08, darkMat, sx * b.w * 0.42, b.belt + 0.32, zb));
  car.add(box(b.w * 0.9, 0.08, 0.08, darkMat, 0, b.belt + 0.6, zb));
  car.add(box(b.w * 0.6, 0.09, 0.1, headMat, 0, b.belt + 0.7, zb));

  for (const sx of [-1, 1]) {
    car.add(box(b.w * 0.2, 0.13, 0.08, headMat, sx * b.w * 0.36, b.hood - 0.2, h + 0.03));
    car.add(box(b.w * 0.12, 0.3, 0.08, tailMat, sx * b.w * 0.42, b.belt - 0.28, -h - 0.03));
    car.add(box(0.16, 0.12, 0.08, darkMat, sx * (b.w / 2 + 0.09), b.belt + 0.1, c3 - 0.3));     // gương
    car.add(box(0.18, 0.05, 1.3, darkMat, sx * (b.w / 2 + 0.06), b.gc + 0.02, 0.05));           // bậc lên xuống
    for (const z of [zr, zf]) car.add(box(0.12, 0.1, b.wr * 2.7, darkMat, sx * (b.w / 2 + 0.02), b.wr * 2 + 0.12, z)); // vè bánh
  }
  car.add(box(b.w * 0.56, 0.3, 0.08, darkMat, 0, b.hood - 0.3, h + 0.04));          // lưới tản nhiệt
  car.add(box(b.w * 0.98, 0.18, 0.16, darkMat, 0, b.gc + 0.16, h + 0.03));          // cản trước
  car.add(box(b.w * 0.5, 0.05, 0.3, rimMat, 0, b.gc + 0.03, h - 0.1));              // tấm chắn gầm
  car.add(box(b.w * 0.98, 0.14, 0.12, darkMat, 0, b.gc + 0.18, -h - 0.03));         // cản sau

  const wx = b.w / 2 - 0.08;
  const wheels = [[wx, zf], [-wx, zf], [wx, zr], [-wx, zr]].map(([x, z]) => {
    const rig = wheelRig(new THREE.Vector3(x, b.wr, z), z > 0);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(b.wr, b.wr, 0.34, 20), tyreMat);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(b.wr * 0.6, b.wr * 0.6, 0.35, 16), darkMat);
    tyre.rotation.z = rim.rotation.z = Math.PI / 2;
    rig.spin.add(tyre, rim);
    for (let k = 0; k < 3; k++) { const sp = box(0.36, b.wr * 1.15, 0.07, rimMat, 0, 0, 0); sp.rotation.x = k * Math.PI / 3; rig.spin.add(sp); }
    car.add(rig.steer);
    return { ...rig, radius: b.wr, z };
  });
  return { wheels, dims: {
    doorX: b.w / 2, rearZ: -h - 0.05, frontZ: h + 0.05, gc: b.gc, wb: b.wb,
    doorY: 0.84, doorZ: (c1 + c2) / 2, plateY: b.belt - 0.4,
  } };
}

// opts: body (tên mẫu xe), color (màu sơn), po (cấp pô 0..3), wing (cấp cánh gió 0..3),
//       text + textColor (chữ dán hai bên cửa), plate (biển số sau), kit (cấp body kit 0..2), glow (màu đèn gầm hoặc rỗng)
export function makeCar({ body = 'NormalCar2', color = '#c81e1e', po = 0, wing = 0, text = '', textColor = '#ffffff', plate = '', kit = 0, glow = '' } = {}) {
  const cfg = MODELS[body];
  const g = new THREE.Group(), car = new THREE.Group();
  car.scale.setScalar(SCALE);
  g.add(car);

  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 });
  const paint2 = paint.clone(); // màu sơn sẫm hơn cho viền, cản
  paint2.color.multiplyScalar(0.5);
  const pick = (table, p) => {
    const mats = p.names.map(n => table[n] || (/^Dark|^Material/.test(n) ? paint2 : paint));
    return p.multi ? mats : mats[0];
  };
  const { wheels, dims } = body === 'Pickup' ? buildPickup(car, paint) : buildFromModel(car, cache[body], pick);

  // Pô: cấp càng cao càng to, từ cấp 2 là pô đôi. Mỗi ống pô có sẵn một ngọn lửa nitro, chỉ hiện khi boost.
  const flames = [];
  for (const sx of po >= 2 ? [-1, 1] : [-1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035 + po * 0.011, 0.035 + po * 0.011, 0.2, 12), pipeMats[po]);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(sx * cfg.w * 0.28, dims.gc + 0.07, cfg.rear - 0.02);
    car.add(pipe);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.7, 8), flameMat);
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(sx * cfg.w * 0.28, dims.gc + 0.07, cfg.rear - 0.45);
    flame.visible = false;
    flames.push(flame);
  }

  // Cánh gió theo cấp
  const zw = cfg.rear + 0.26;
  if (wing === 1) car.add(box(cfg.w * 0.9, 0.045, 0.15, darkMat, 0, cfg.deck + 0.02, zw));
  if (wing >= 2) {
    const up = wing === 2 ? 0.17 : 0.3, span = wing === 2 ? cfg.w : cfg.w * 1.14;
    car.add(box(span, 0.03, wing === 2 ? 0.24 : 0.32, darkMat, 0, cfg.deck + up, zw));
    for (const sx of [-1, 1]) {
      car.add(box(0.035, up, 0.11, darkMat, sx * cfg.w * 0.32, cfg.deck + up / 2, zw));
      if (wing === 3) car.add(box(0.03, 0.18, 0.38, darkMat, sx * span / 2, cfg.deck + up, zw));
    }
  }

  // Body kit. Cấp 1: lip trước và ốp sườn. Cấp 2: thêm vè bánh, cánh mũi, khuếch tán gió sau.
  if (kit >= 1) {
    car.add(box(dims.doorX * 1.85, 0.05, 0.32, darkMat, 0, dims.gc + 0.01, dims.frontZ - 0.06));
    for (const sx of [-1, 1]) car.add(box(0.07, 0.1, dims.wb * 0.6, darkMat, sx * (dims.doorX + 0.01), dims.gc + 0.05, 0));
  }
  if (kit >= 2) {
    for (const w of wheels) {
      const sx = Math.sign(w.steer.position.x);
      car.add(box(0.1, 0.13, w.radius * 2.6, paint2, sx * (dims.doorX + 0.05), w.radius * 2 + 0.06, w.z));
    }
    for (const sx of [-1, 1]) {
      const canard = box(0.32, 0.03, 0.18, darkMat, sx * (dims.doorX - 0.02), dims.gc + 0.22, dims.frontZ - 0.16);
      canard.rotation.z = sx * 0.35;
      car.add(canard);
    }
    for (const x of [-0.45, -0.15, 0.15, 0.45]) car.add(box(0.03, 0.13, 0.32, darkMat, x, dims.gc + 0.03, dims.rearZ + 0.14));
  }

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  flames.forEach(f => car.add(f));

  // Chữ dán hai bên cửa
  text = text.trim();
  if (text) {
    const decal = new THREE.MeshStandardMaterial({ map: textTexture(text, textColor, false), transparent: true, roughness: 0.5, depthWrite: false });
    for (const sx of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), decal);
      d.position.set(sx * (dims.doorX + 0.012), dims.doorY, dims.doorZ);
      d.rotation.y = sx * Math.PI / 2;
      car.add(d);
    }
  }
  // Biển số phía sau
  plate = plate.trim();
  if (plate) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13),
      new THREE.MeshStandardMaterial({ map: textTexture(plate, '#111', true), roughness: 0.6 }));
    m.position.set(0, dims.plateY, dims.rearZ - 0.012);
    m.rotation.y = Math.PI;
    car.add(m);
  }
  // Đèn gầm: quầng sáng màu hắt xuống mặt đường và hai dải đèn dưới sườn xe
  if (glow) {
    const len = dims.frontZ - dims.rearZ;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(dims.doorX * 2 + 1.8, len + 1.8), new THREE.MeshBasicMaterial({
      map: glowTex(), color: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -12,
    }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.035, (dims.frontZ + dims.rearZ) / 2);
    car.add(pool);
    const strip = new THREE.MeshBasicMaterial({ color: glow });
    for (const sx of [-1, 1]) car.add(box(0.04, 0.03, dims.wb * 0.75, strip, sx * (dims.doorX - 0.06), dims.gc - 0.01, 0));
  }

  g.userData.drive = (dist, steerAngle) => {
    for (const w of wheels) {
      w.spin.rotation.x += dist / (w.radius * SCALE);
      if (w.front) w.steer.rotation.y = steerAngle;
    }
  };
  g.userData.boost = (on) => { for (const f of flames) f.visible = on; };
  return g;
}
