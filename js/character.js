// Nhân vật tay đua dựng bằng các khối đơn giản. Cao khoảng 1,75 m, mặt quay về hướng +z.
import * as THREE from 'three';

const mat = (color) => new THREE.MeshLambertMaterial({ color });

// Họa tiết đồ đua, vẽ lên canvas. Mỗi mặt của tay, chân, thân đều được phủ trọn một ảnh,
// nên phần đáy ảnh rơi vào gấu quần, cổ tay và lưng quần.
function flames(ctx, s, colors) {
  // Mỗi lưỡi lửa là một hình nhọn cong, lớp ngoài to màu đậm, lớp trong nhỏ màu sáng
  colors.forEach((col, layer) => {
    const k = 1 - layer * 0.28;
    ctx.fillStyle = col;
    for (let i = 0; i < 6; i++) {
      const x = (i + 0.5) * s / 6, h = s * (0.55 + 0.3 * Math.sin(i * 2.3)) * k, w = s / 6 * k;
      ctx.beginPath();
      ctx.moveTo(x - w, s);
      ctx.quadraticCurveTo(x - w * 0.9, s - h * 0.55, x + w * 0.35, s - h);
      ctx.quadraticCurveTo(x - w * 0.05, s - h * 0.5, x + w, s);
      ctx.fill();
    }
  });
}
function shade(hex, f) {
  const c = new THREE.Color(hex).multiplyScalar(f);
  return '#' + c.getHexString();
}
const DRAW = {
  none() {},
  flame(ctx, s) { flames(ctx, s, ['#c41a00', '#ff6a00', '#ffd23a']); },
  blueflame(ctx, s) { flames(ctx, s, ['#0a3fd6', '#2fa8ff', '#c9f1ff']); },
  stripes(ctx, s) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(s * 0.3, 0, s * 0.13, s); ctx.fillRect(s * 0.57, 0, s * 0.13, s);
    ctx.fillStyle = '#111111';
    ctx.fillRect(s * 0.43, 0, s * 0.14, s);
  },
  checker(ctx, s) {
    const n = 8, c = s / n;
    for (let y = 0; y < 3; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#ffffff' : '#111111';
      ctx.fillRect(x * c, s - (y + 1) * c, c, c);
    }
  },
  lightning(ctx, s) {
    ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = '#111111'; ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    for (const [x, y] of [[0.62, 0], [0.3, 0.48], [0.5, 0.48], [0.32, 1], [0.75, 0.4], [0.54, 0.4], [0.8, 0]]) ctx.lineTo(x * s, y * s);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  },
  camo(ctx, s, base) {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const f of [0.55, 1.35, 0.3]) {
      ctx.fillStyle = shade(base, f);
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.ellipse(rnd() * s, rnd() * s, s * (0.08 + rnd() * 0.1), s * (0.05 + rnd() * 0.07), rnd() * 3, 0, 7);
        ctx.fill();
      }
    }
  },
  tiger(ctx, s) {
    ctx.fillStyle = '#111111';
    for (let i = 0; i < 5; i++) {
      const y = (i + 0.4) * s / 5;
      ctx.beginPath();
      ctx.moveTo(0, y - s * 0.05); ctx.lineTo(s * 0.45, y + s * 0.02); ctx.lineTo(0, y + s * 0.07);
      ctx.moveTo(s, y - s * 0.02); ctx.lineTo(s * 0.55, y + s * 0.05); ctx.lineTo(s, y + s * 0.1);
      ctx.fill();
    }
  },
  star(ctx, s) {
    ctx.fillStyle = '#ffffff';
    for (const [x, y, r] of [[0.5, 0.45, 0.22], [0.15, 0.15, 0.08], [0.85, 0.82, 0.09], [0.82, 0.12, 0.06], [0.18, 0.85, 0.07]]) {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5, rr = (k % 2 ? 0.42 : 1) * r * s;
        ctx.lineTo(x * s + Math.cos(a) * rr, y * s + Math.sin(a) * rr);
      }
      ctx.fill();
    }
  },
};

const suitCache = new Map();
function suitMaterial(color, pattern) {
  const key = `${color}|${pattern}`;
  if (suitCache.has(key)) return suitCache.get(key);
  let m;
  if (!DRAW[pattern] || pattern === 'none') m = mat(color);
  else {
    const c = document.createElement('canvas'), s = 128;
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, s, s);
    DRAW[pattern](ctx, s, color);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.MeshLambertMaterial({ map: t });
  }
  suitCache.set(key, m);
  return m;
}

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const metal = (color, emissive = 0x000000) => new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.3, metalness: 0.8 });

// Phụ kiện đội đầu. Đầu là khối 0,3 m, tâm ở độ cao 1,68 m, mặt trước ở z = 0,15.
// Mỗi hàm thêm khối vào nhóm g; dùng các vật liệu được truyền vào trong m.
const HATS = {
  cap(g, m) {
    g.add(box(0.34, 0.09, 0.34, m.red, 0, 1.9, 0));
    g.add(box(0.28, 0.03, 0.18, m.red, 0, 1.86, 0.24));
  },
  backcap(g, m) {
    g.add(box(0.34, 0.09, 0.34, m.blue, 0, 1.9, 0));
    g.add(box(0.28, 0.03, 0.18, m.blue, 0, 1.86, -0.24));
  },
  helmet(g, m) {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), m.suit);
    shell.position.set(0, 1.7, 0);
    shell.castShadow = true;
    g.add(shell);
    g.add(box(0.3, 0.1, 0.06, m.black, 0, 1.71, 0.2));
  },
  beanie(g, m) {
    g.add(box(0.34, 0.17, 0.34, m.suit, 0, 1.9, 0));
    g.add(box(0.35, 0.05, 0.35, m.dark, 0, 1.83, 0));
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), m.white);
    pom.position.set(0, 2.03, 0);
    g.add(pom);
  },
  cowboy(g, m) {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 20), m.brown);
    brim.position.set(0, 1.88, 0);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.16, 16), m.brown);
    top.position.set(0, 1.97, 0);
    brim.castShadow = top.castShadow = true;
    g.add(brim, top, box(0.37, 0.035, 0.37, m.dark, 0, 1.91, 0));
  },
  crown(g, m) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 8, 1, true), m.gold);
    band.material.side = THREE.DoubleSide;
    band.position.set(0, 1.94, 0);
    g.add(band);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), m.gold);
      spike.position.set(Math.cos(a) * 0.16, 2.02, Math.sin(a) * 0.16);
      g.add(spike);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), m.gem);
    gem.position.set(0, 1.94, 0.175);
    g.add(gem);
  },
  bandana(g, m) {
    g.add(box(0.345, 0.09, 0.345, m.red, 0, 1.83, 0));
    g.add(box(0.08, 0.06, 0.05, m.red, 0, 1.83, -0.2));
    const tail = box(0.05, 0.16, 0.03, m.red, 0.03, 1.74, -0.21);
    tail.rotation.z = 0.25;
    g.add(tail);
  },
  mohawk(g, m) {
    g.add(box(0.07, 0.17, 0.32, m.hair, 0, 1.98, -0.01));
  },
  horns(g, m) {
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 8), m.red);
      horn.position.set(sx * 0.12, 1.97, 0.04);
      horn.rotation.z = -sx * 0.45;
      g.add(horn);
    }
  },
  halo(g, m) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 24), m.glowGold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 2.07, 0);
    g.add(ring);
  },
};

// Phụ kiện trên mặt
const FACES = {
  glasses(g, m) { g.add(box(0.3, 0.07, 0.03, m.black, 0, 1.7, 0.16)); },
  goggles(g, m) {
    g.add(box(0.32, 0.05, 0.32, m.dark, 0, 1.71, 0));
    for (const sx of [-1, 1]) g.add(box(0.11, 0.085, 0.04, m.lens, sx * 0.07, 1.71, 0.165));
  },
  headphone(g, m) {
    g.add(box(0.36, 0.04, 0.05, m.dark, 0, 1.93, 0));
    for (const sx of [-1, 1]) g.add(box(0.05, 0.14, 0.12, m.red, sx * 0.175, 1.7, 0));
  },
  mask(g, m) {
    g.add(box(0.26, 0.12, 0.03, m.white, 0, 1.6, 0.155));
    for (const sx of [-1, 1]) g.add(box(0.02, 0.02, 0.16, m.white, sx * 0.155, 1.63, 0.07));
  },
  mustache(g, m) {
    for (const sx of [-1, 1]) {
      const half = box(0.08, 0.03, 0.02, m.hair, sx * 0.045, 1.63, 0.158);
      half.rotation.z = sx * 0.25;
      g.add(half);
    }
  },
};

// Phụ kiện ở cổ và lưng
const NECKS = {
  scarf(g, m) {
    g.add(box(0.2, 0.08, 0.2, m.red, 0, 1.48, 0));
    const tail = box(0.08, 0.3, 0.03, m.red, 0.08, 1.34, 0.14);
    tail.rotation.z = 0.15;
    g.add(tail);
  },
  chain(g, m) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.014, 6, 20), m.gold);
    ring.rotation.x = Math.PI / 2 - 0.5;
    ring.position.set(0, 1.4, 0.06);
    g.add(ring, box(0.06, 0.07, 0.02, m.gold, 0, 1.3, 0.14));
  },
  bowtie(g, m) {
    for (const sx of [-1, 1]) g.add(box(0.07, 0.07, 0.02, m.red, sx * 0.045, 1.44, 0.135));
    g.add(box(0.03, 0.04, 0.025, m.dark, 0, 1.44, 0.137));
  },
  medal(g, m) {
    for (const sx of [-1, 1]) {
      const strip = box(0.04, 0.2, 0.01, m.blue, sx * 0.05, 1.37, 0.133);
      strip.rotation.z = sx * 0.3;
      g.add(strip);
    }
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 16), m.gold);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, 1.25, 0.14);
    g.add(disc);
  },
  cape(g, m) {
    const cape = box(0.48, 0.95, 0.025, m.red, 0, 1.0, -0.16);
    cape.rotation.x = 0.12;
    g.add(cape);
  },
};

// opts: skin (màu da), hair (màu tóc), suit (màu áo đua), pattern (họa tiết đồ đua, xem PATTERNS trong data.js),
//       hat, face, neck (phụ kiện từng nhóm, xem ACCESSORIES trong data.js), cheer (true = giơ hai tay ăn mừng).
//       acc là cách lưu cũ chỉ có một phụ kiện, vẫn đọc được.
export function makeCharacter({ skin = '#f1c27d', hair = '#151515', suit = '#ff7a1a', pattern = 'none',
  hat, face, neck = 'none', acc = 'none', cheer = false } = {}) {
  hat ??= HATS[acc] ? acc : 'none';
  face ??= FACES[acc] ? acc : 'none';
  const g = new THREE.Group();
  const skinM = mat(skin), suitM = suitMaterial(suit, pattern), darkM = mat(0x1d2230), hairM = mat(hair);

  // Chân, giày, thân, sọc áo
  for (const sx of [-1, 1]) {
    g.add(box(0.17, 0.78, 0.2, suitM, sx * 0.11, 0.47, 0));
    g.add(box(0.19, 0.1, 0.3, darkM, sx * 0.11, 0.05, 0.04));
  }
  g.add(box(0.46, 0.6, 0.26, suitM, 0, 1.16, 0));
  g.add(box(0.47, 0.1, 0.27, darkM, 0, 1.2, 0));

  // Tay: buông xuôi hoặc giơ lên ăn mừng
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.3, 1.4, 0);
    arm.add(box(0.13, 0.56, 0.15, suitM, 0, -0.26, 0));
    arm.add(box(0.12, 0.12, 0.13, skinM, 0, -0.6, 0));
    arm.rotation.z = cheer ? sx * 2.6 : sx * 0.12;
    g.add(arm);
  }

  // Đầu, mắt, tóc
  g.add(box(0.14, 0.08, 0.14, skinM, 0, 1.5, 0));
  g.add(box(0.3, 0.3, 0.3, skinM, 0, 1.68, 0));
  for (const sx of [-1, 1]) g.add(box(0.045, 0.045, 0.02, darkM, sx * 0.07, 1.7, 0.151));
  if (hat !== 'helmet') {
    g.add(box(0.33, 0.1, 0.33, hairM, 0, 1.86, 0));
    g.add(box(0.33, 0.22, 0.09, hairM, 0, 1.74, -0.13));
  }

  // Phụ kiện: mỗi nhóm một món. Nón bảo hiểm che cả mặt nên không đeo đồ trên mặt.
  const m = {
    suit: suitM, dark: darkM, hair: hairM,
    red: mat(0xc62828), blue: mat(0x1e5bd6), white: mat(0xf2f2f2), black: mat(0x0a0a0a), brown: mat(0x7a4a22),
    gold: metal(0xf2c230), gem: metal(0xe0204a, 0x500010), glowGold: metal(0xffe066, 0xffc400),
    lens: new THREE.MeshStandardMaterial({ color: 0xff8a1a, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.85 }),
  };
  if (HATS[hat]) HATS[hat](g, m);
  if (FACES[face] && hat !== 'helmet') FACES[face](g, m);
  if (NECKS[neck]) NECKS[neck](g, m);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
