// Dữ liệu game: xe, đồ chơi, giải đua.
// Muốn cân bằng lại game (giá tiền, độ mạnh) thì chỉ cần sửa số trong file này.
// Đơn vị: top = tốc độ tối đa (m/s, nhân 3.6 ra km/h), accel = độ bốc, grip = độ bám cua, brake = lực phanh.
// body = tên mẫu xe 3D, xem danh sách trong car.js.

export const CARS = [
  { id: 'hatch', body: 'NormalCar2', name: 'Xe cỏ 1.5', desc: 'Nhỏ gọn, rẻ, dễ lái. Xe khởi nghiệp.', price: 0,
    base: { top: 46, accel: 5.0, grip: 10.5, brake: 12 } },
  { id: 'sedan', body: 'NormalCar1', name: 'Sedan 2.0', desc: 'Cân bằng mọi mặt, chạy ổn định.', price: 6000,
    base: { top: 54, accel: 5.8, grip: 11.0, brake: 13 } },
  { id: 'taxi', body: 'Taxi', name: 'Taxi về hưu', desc: 'Máy lì đòn, đề bốc, nhưng phanh đã mòn.', price: 9000,
    base: { top: 52, accel: 6.6, grip: 10.6, brake: 11.5 } },
  { id: 'raptor', body: 'Pickup', name: 'Bán tải Raptor', desc: 'Gầm cao, lốp to. Vua đường đất và leo dốc.', price: 12000, offroad: 1,
    base: { top: 56, accel: 7.4, grip: 10.0, brake: 12.5 } },
  { id: 'suv', body: 'SUV', name: 'SUV 3.0', desc: 'Máy khỏe, thân cao nên ôm cua kém. Đi đường đất khá.', price: 14000, offroad: 0.6,
    base: { top: 58, accel: 6.6, grip: 10.2, brake: 13.5 } },
  { id: 'cop', body: 'Cop', name: 'Xe tuần tra thanh lý', desc: 'Máy đuổi bắt, tốc độ cao, phanh tốt.', price: 20000,
    base: { top: 66, accel: 7.2, grip: 11.8, brake: 16 } },
  { id: 'coupe', body: 'SportsCar', name: 'Coupe thể thao', desc: 'Thấp, nhẹ, ôm cua rất tốt.', price: 30000,
    base: { top: 70, accel: 8.2, grip: 13.8, brake: 16.5 } },
  { id: 'super', body: 'SportsCar2', name: 'Xe đua GT', desc: 'Nhanh nhất gara. Sai một li là hôn tường.', price: 80000,
    base: { top: 86, accel: 11.0, grip: 15.0, brake: 19 } },
];

// Mỗi món đồ có 4 cấp (0 = zin). fx là phần cộng thêm vào chỉ số khi đang gắn cấp đó.
export const PARTS = [
  { id: 'po', name: 'Pô', levels: [
    { name: 'Pô zin', price: 0, fx: {} },
    { name: 'Pô thể thao', price: 600, fx: { top: 3, accel: 0.3 } },
    { name: 'Pô on-off', price: 1800, fx: { top: 6, accel: 0.6 } },
    { name: 'Pô titan full', price: 5000, fx: { top: 10, accel: 1.0 } },
  ] },
  { id: 'may', name: 'Động cơ', levels: [
    { name: 'Máy zin', price: 0, fx: {} },
    { name: 'Remap ECU', price: 1000, fx: { top: 5, accel: 0.6 } },
    { name: 'Turbo', price: 3200, fx: { top: 11, accel: 1.3 } },
    { name: 'Turbo kép + lót máy', price: 9000, fx: { top: 18, accel: 2.2 } },
  ] },
  { id: 'hopso', name: 'Hộp số', levels: [
    { name: 'Hộp số zin', price: 0, fx: {} },
    { name: 'Ly hợp thể thao', price: 500, fx: { accel: 0.6 } },
    { name: 'Tỉ số truyền ngắn', price: 1600, fx: { accel: 1.2 } },
    { name: 'Hộp số đua', price: 4200, fx: { accel: 2.0 } },
  ] },
  { id: 'lop', name: 'Lốp', levels: [
    { name: 'Lốp zin', price: 0, fx: {} },
    { name: 'Lốp thể thao', price: 600, fx: { grip: 1.2, brake: 0.8 } },
    { name: 'Lốp bán slick', price: 1900, fx: { grip: 2.4, brake: 1.6 } },
    { name: 'Lốp slick', price: 4800, fx: { grip: 3.8, brake: 2.4 } },
  ] },
  { id: 'phanh', name: 'Phanh', levels: [
    { name: 'Phanh zin', price: 0, fx: {} },
    { name: 'Má phanh xịn', price: 400, fx: { brake: 2 } },
    { name: 'Heo 4 pít + đĩa lớn', price: 1500, fx: { brake: 4 } },
    { name: 'Phanh gốm carbon', price: 4000, fx: { brake: 6.5 } },
  ] },
  { id: 'phuoc', name: 'Phuộc', levels: [
    { name: 'Phuộc zin', price: 0, fx: {} },
    { name: 'Lò xo hạ gầm', price: 500, fx: { grip: 0.6 } },
    { name: 'Phuộc ty ren', price: 1600, fx: { grip: 1.2 } },
    { name: 'Phuộc đua', price: 4000, fx: { grip: 2.0 } },
  ] },
  { id: 'canh', name: 'Cánh gió', levels: [
    { name: 'Không cánh', price: 0, fx: {} },
    { name: 'Lip đuôi', price: 400, fx: { grip: 0.5 } },
    { name: 'Cánh gió thể thao', price: 1400, fx: { grip: 1.0 } },
    { name: 'Cánh GT carbon', price: 3600, fx: { grip: 1.7 } },
  ] },
];

// maxLevel = tổng cấp đồ tối đa được phép. ai = đối thủ mạnh cỡ bao nhiêu phần của một xe độ kịch (0..1).
export const CLASSES = [
  { id: 'zin', name: 'Giải Xe Zin', desc: 'Xe nguyên bản hoặc độ rất nhẹ.', maxLevel: 3, laps: 2,
    prizes: [900, 550, 350, 200, 120, 60], ai: [0.0, 0.18] },
  { id: 'nhe', name: 'Giải Độ Nhẹ', desc: 'Độ vừa phải, hơn nhau ở tay lái.', maxLevel: 10, laps: 3,
    prizes: [2800, 1700, 1000, 500, 300, 150], ai: [0.22, 0.48] },
  { id: 'full', name: 'Giải Độ Full', desc: 'Không giới hạn đồ chơi.', maxLevel: 99, laps: 3,
    prizes: [8000, 5000, 3000, 1500, 800, 400], ai: [0.55, 0.92] },
];

export const COLORS = ['#c81e1e', '#1553b5', '#f2b90c', '#15161a', '#eceff3', '#12894a', '#ff6a00', '#6d2ea3', '#8a9099'];

export const AI_NAMES = ['Tèo Drift', 'Hùng Turbo', 'Tí Zin', 'Sơn Nài', 'Bảy Số Sàn', 'Tư Slick', 'Út Lốp', 'Long Ga Lì'];

// Nhiệm vụ. stat = con số được theo dõi (xem missionProgress bên dưới), target = mốc cần đạt, reward = tiền thưởng.
export const MISSIONS = [
  { id: 'race1', name: 'Ra quân', desc: 'Hoàn thành 1 cuộc đua', stat: 'races', target: 1, reward: 300 },
  { id: 'part1', name: 'Món đồ đầu tiên', desc: 'Mua 1 món đồ độ', stat: 'partsBought', target: 1, reward: 300 },
  { id: 'podium3', name: 'Lên bục', desc: 'Về top 3 ba lần', stat: 'podiums', target: 3, reward: 1000 },
  { id: 'win1', name: 'Chiến thắng đầu tay', desc: 'Về nhất 1 lần', stat: 'wins', target: 1, reward: 800 },
  { id: 'clean1', name: 'Tay lái sạch', desc: 'Về đích mà không chạm tường lần nào', stat: 'cleanRaces', target: 1, reward: 700 },
  { id: 'speed200', name: 'Hai trăm', desc: 'Đạt 200 km/h trong một cuộc đua', stat: 'topKmh', target: 200, reward: 600 },
  { id: 'dist20', name: 'Chạy rốt-đa', desc: 'Chạy tổng cộng 20 km', stat: 'distKm', target: 20, reward: 1000 },
  { id: 'city1', name: 'Vua phố đêm', desc: 'Về nhất trên đường Phố đêm', stat: 'cityWins', target: 1, reward: 1500 },
  { id: 'dirt1', name: 'Vua đường đất', desc: 'Về nhất trên đường Đồi Xoáy', stat: 'dirtWins', target: 1, reward: 2000 },
  { id: 'max1', name: 'Độ kịch', desc: 'Nâng 1 món đồ lên cấp 3', stat: 'maxedParts', target: 1, reward: 1500 },
  { id: 'cars2', name: 'Xe thứ hai', desc: 'Sở hữu 2 chiếc xe', stat: 'cars', target: 2, reward: 2000 },
  { id: 'race10', name: 'Tay đua chăm chỉ', desc: 'Hoàn thành 10 cuộc đua', stat: 'races', target: 10, reward: 1500 },
  { id: 'part10', name: 'Nghiện độ', desc: 'Mua 10 món đồ độ', stat: 'partsBought', target: 10, reward: 2500 },
  { id: 'win5', name: 'Thắng như chẻ tre', desc: 'Về nhất 5 lần', stat: 'wins', target: 5, reward: 3000 },
  { id: 'full1', name: 'Vô địch độ full', desc: 'Về nhất Giải Độ Full', stat: 'fullWins', target: 1, reward: 5000 },
  { id: 'speed300', name: 'Ba trăm', desc: 'Đạt 300 km/h trong một cuộc đua', stat: 'topKmh', target: 300, reward: 4000 },
  { id: 'dist100', name: 'Trăm cây số', desc: 'Chạy tổng cộng 100 km', stat: 'distKm', target: 100, reward: 5000 },
  { id: 'cars4', name: 'Nhà sưu tập', desc: 'Sở hữu 4 chiếc xe', stat: 'cars', target: 4, reward: 8000 },
];
// Nhiệm vụ lặp lại mỗi ngày
export const DAILY = { id: 'daily', name: 'Nhiệm vụ hôm nay', desc: 'Hoàn thành 3 cuộc đua trong ngày', target: 3, reward: 500 };

// Tiến độ hiện tại của một nhiệm vụ, tính từ bản lưu
export function missionProgress(save, m) {
  if (m.stat === 'cars') return Object.keys(save.owned).length;
  if (m.stat === 'maxedParts') {
    let n = 0;
    for (const car of Object.values(save.owned)) for (const lv of Object.values(car.parts)) if (lv >= 3) n++;
    return n;
  }
  return save.stats[m.stat] || 0;
}

// Khả năng đi đường đất của từng mẫu xe (0 = kém, 1 = tốt nhất). Xe của đối thủ cũng dùng bảng này.
export const OFFROAD = { Pickup: 1, SUV: 0.6 };
// Trên đường đất, xe gầm thấp bị giảm tốc độ, độ bốc và độ bám
export function onDirt(st, offroad) {
  return { ...st, top: st.top * (0.82 + 0.18 * offroad), accel: st.accel * (0.85 + 0.15 * offroad), grip: st.grip * (0.68 + 0.32 * offroad) };
}

// Đồ trang trí (không tính vào tổng cấp đồ, không làm xe mạnh hơn)
export const KITS = [
  { name: 'Thân zin', desc: 'Không gắn thêm gì.', price: 0 },
  { name: 'Body kit đường phố', desc: 'Lip trước và ốp sườn.', price: 1500 },
  { name: 'Body kit thân rộng', desc: 'Thêm vè bánh, cánh mũi và khuếch tán gió sau.', price: 4500 },
];
export const GLOW_PRICE = 800;
export const GLOW_COLORS = ['#00e5ff', '#ff2bd6', '#7dff3c', '#ff7a1a', '#ffffff', '#7a4dff'];
export const TEXT_COLORS = ['#ffffff', '#111111', '#ffd400', '#ff3b30', '#27c2ff'];

// Lựa chọn cho nhân vật
export const SKINS = ['#ffd9b8', '#f1c27d', '#d39a6a', '#a8703f', '#6b4423'];
export const HAIRS = ['#151515', '#4a2c14', '#a4581c', '#e6c36a', '#d8d8d8', '#c62828', '#2a6bd6'];
export const SUITS = ['#ff7a1a', '#c81e1e', '#1553b5', '#15161a', '#eceff3', '#12894a', '#f2b90c', '#6d2ea3'];
// Họa tiết đồ đua. id phải trùng với tên hàm vẽ trong character.js
export const PATTERNS = [
  { id: 'none', name: 'Trơn' }, { id: 'flame', name: 'Lửa' }, { id: 'blueflame', name: 'Lửa xanh' },
  { id: 'stripes', name: 'Sọc đua' }, { id: 'checker', name: 'Caro' }, { id: 'lightning', name: 'Tia sét' },
  { id: 'tiger', name: 'Vằn hổ' }, { id: 'camo', name: 'Rằn ri' }, { id: 'star', name: 'Ngôi sao' },
];
// Phụ kiện chia 3 nhóm, mỗi nhóm đeo được một món, nên một tay đua đeo được tối đa 3 món cùng lúc.
// id phải trùng với tên món trong character.js
export const ACCESSORIES = {
  hat: { name: 'Đội đầu', items: [
    { id: 'none', name: 'Không' }, { id: 'cap', name: 'Nón lưỡi trai' }, { id: 'backcap', name: 'Nón đội ngược' },
    { id: 'helmet', name: 'Nón bảo hiểm' }, { id: 'beanie', name: 'Mũ len' }, { id: 'cowboy', name: 'Nón cao bồi' },
    { id: 'crown', name: 'Vương miện' }, { id: 'bandana', name: 'Khăn bandana' }, { id: 'mohawk', name: 'Tóc mohawk' },
    { id: 'horns', name: 'Sừng quỷ' }, { id: 'halo', name: 'Vòng thiên thần' },
  ] },
  face: { name: 'Mặt', items: [
    { id: 'none', name: 'Không' }, { id: 'glasses', name: 'Kính râm' }, { id: 'goggles', name: 'Kính đua' },
    { id: 'headphone', name: 'Tai nghe' }, { id: 'mask', name: 'Khẩu trang' }, { id: 'mustache', name: 'Ria mép' },
  ] },
  neck: { name: 'Cổ và lưng', items: [
    { id: 'none', name: 'Không' }, { id: 'scarf', name: 'Khăn quàng' }, { id: 'chain', name: 'Dây chuyền vàng' },
    { id: 'bowtie', name: 'Nơ cổ' }, { id: 'medal', name: 'Huy chương' }, { id: 'cape', name: 'Áo choàng' },
  ] },
};
export const TITLES = ['Vô địch', 'Á quân', 'Hạng ba'];

export const START_MONEY = 1000;
export const SELL_RATE = 0.5;

const STAT_KEYS = ['top', 'accel', 'grip', 'brake'];

export function getCar(id) { return CARS.find(c => c.id === id); }

export function emptyParts() {
  const o = {};
  for (const p of PARTS) o[p.id] = 0;
  return o;
}

export function calcStats(carId, parts) {
  const st = { ...getCar(carId).base };
  for (const p of PARTS) {
    const fx = p.levels[parts[p.id] || 0].fx;
    for (const k of STAT_KEYS) st[k] += fx[k] || 0;
  }
  return st;
}

export function totalLevel(parts) {
  return PARTS.reduce((s, p) => s + (parts[p.id] || 0), 0);
}

// Chỉ số của một đối thủ máy: mạnh ngang xe của người chơi khi độ tới mức frac (0 = zin, 1 = độ kịch).
export function aiStats(carId, frac) {
  const st = { ...getCar(carId).base };
  for (const p of PARTS) {
    const fx = p.levels[p.levels.length - 1].fx;
    for (const k of STAT_KEYS) st[k] += (fx[k] || 0) * frac;
  }
  return st;
}
