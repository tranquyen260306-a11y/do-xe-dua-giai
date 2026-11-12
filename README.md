# Độ Xe Đua Giải

Game đua xe 3D chạy ngay trên trình duyệt: đua kiếm tiền, mua đồ độ xe, custom ngoại hình, lên giải lớn hơn.

**Chơi ngay:** https://tranquyen260306-a11y.github.io/do-xe-dua-giai/

## Có gì trong game

- 8 xe, từ xe cỏ tới xe đua GT và bán tải Raptor
- 7 món đồ độ, mỗi món 3 cấp; custom màu sơn, chữ dán, biển số, đèn gầm, body kit
- 5 đường đua: Đồi Thông, Phố đêm, Đồi Xoáy (đường đất), Ven biển, Oval tốc độ
- Hộp số tay hoặc tự động, nitro, trợ lái
- Tạo tay đua với màu áo, họa tiết và phụ kiện; bục vinh danh cho top 3
- Nhiệm vụ nhận thưởng, nhiệm vụ hằng ngày

## Điều khiển

| Phím | Tác dụng |
|---|---|
| W / S | Ga / phanh |
| A / D | Đánh lái |
| M | Nitro |
| G | Đổi số tay / tự động |
| 1 – 5 | Gài số (khi chạy số tay) |
| R | Đưa xe về giữa đường |
| Esc / P | Tạm dừng |

Trên điện thoại có nút bấm trên màn hình.

## Chạy trên máy

Cần cài Node.js. Mở thư mục này trong terminal rồi chạy:

```bash
node server.js
```

Sau đó mở http://localhost:5173. Game tải thư viện 3D (Three.js) từ mạng nên máy cần có internet.

## Cấu trúc code

- `js/data.js`: xe, đồ độ, giải đua, nhiệm vụ, phụ kiện. Muốn cân bằng lại game thì sửa số ở đây.
- `js/race.js`: đường đua và cuộc đua
- `js/car.js`: mô hình xe
- `js/character.js`: nhân vật tay đua
- `js/main.js`: giao diện, gara, bục vinh danh
- `js/sound.js`: tiếng máy

## Ghi công

Mô hình xe trong `assets/cars` thuộc bộ **Realistic Car Pack** của [Quaternius](https://quaternius.com), giấy phép CC0 (dùng tự do).
