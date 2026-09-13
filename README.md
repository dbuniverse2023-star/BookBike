# Hệ thống đặt xe qua Facebook Messenger (MVP)

Backend (Node.js/Express + PostgreSQL) + Mini Web App bản đồ (Leaflet/OpenStreetMap) cho luồng đặt xe qua Facebook Messenger.

## Cấu trúc thư mục

```
messenger-ride-mvp/
├── server.js                  # Entry point - khởi tạo Express app
├── package.json
├── .env.example                # Copy thành .env và điền giá trị thật
├── db/
│   ├── schema.sql              # Migration: tạo bảng users, drivers, trips
│   ├── migrate.js              # Chạy: npm run migrate
│   └── pool.js                 # PostgreSQL connection pool
├── services/
│   ├── userService.js          # CRUD users
│   ├── driverService.js        # CRUD drivers + thuật toán tìm tài xế gần nhất (Haversine)
│   ├── tripService.js          # Toàn bộ vòng đời chuyến đi (pending -> searching -> accepted -> completed)
│   └── distanceService.js      # Tính khoảng cách thực tế (OSRM, fallback Haversine)
├── messenger/
│   ├── webhook.js               # GET verify + POST xử lý tin nhắn/postback từ Messenger
│   └── messengerApi.js          # Gửi tin nhắn/Quick Reply/Button/Webview qua Send API
├── routes/
│   └── tripRoutes.js            # REST API: set-destination, confirm, accept, complete
├── utils/
│   ├── haversine.js
│   └── price.js                 # calculatePrice(distance_km)
└── public/
    └── index.html                # Mini Web App bản đồ (mobile-optimized)
```

## Cài đặt

```bash
npm install
cp .env.example .env
# Điền DATABASE_URL, FB_VERIFY_TOKEN, FB_PAGE_ACCESS_TOKEN, FB_APP_SECRET, BASE_URL
npm run migrate     # Tạo bảng users / drivers / trips trong PostgreSQL
npm start           # hoặc: npm run dev (với nodemon)
```

Server chạy tại `http://localhost:3000`. Mini Web App được phục vụ tại `/`, webhook tại `/webhook`, API tại `/api/trips/*`.

## Kết nối với Facebook Messenger

1. Deploy server lên một domain public có HTTPS (Render, Railway, Fly.io, VPS + Nginx...). Cập nhật `BASE_URL` trong `.env`.
2. Trong Meta for Developers > App của bạn > Messenger > Settings:
   - Webhook URL: `https://<BASE_URL>/webhook`
   - Verify Token: giá trị trùng với `FB_VERIFY_TOKEN` trong `.env`
   - Subscribe fields: `messages`, `messaging_postbacks`
3. Lấy **Page Access Token** và điền vào `FB_PAGE_ACCESS_TOKEN`.
4. (Khuyến nghị) Điền **App Secret** vào `FB_APP_SECRET` để hệ thống xác thực chữ ký `X-Hub-Signature-256` của mọi request đến từ Meta.
5. Trong Messenger domain whitelist (App > Messenger > Advanced Messaging > Whitelisted Domains), thêm domain của `BASE_URL` để webview bản đồ được phép mở.

## Luồng hoạt động

1. Khách nhắn **"Đặt xe"** → Bot gửi Quick Reply yêu cầu chia sẻ vị trí (built-in location share).
2. Khách chia sẻ vị trí → Backend tạo `trip` (status = `pending`) với `pickup_lat/lng` → Bot gửi nút mở **Mini Web App** kèm `trip_id`, `user_id` trên URL.
3. Trong Mini Web App: khách tìm kiếm địa điểm hoặc kéo ghim, bấm **"Xác nhận điểm đến"** → gọi `POST /api/trips/set-destination`.
4. Backend gọi OSRM để tính khoảng cách đường thực tế → `calculatePrice()` → lưu `distance_km`, `price` → gửi khung xác nhận giá cước về Messenger, webview tự đóng.
5. Khách bấm **"Xác nhận đặt xe"** (postback `CONFIRM_TRIP_<id>`) → `status = searching` → hệ thống tìm tài xế `available = true` gần nhất trong bán kính `MAX_DRIVER_SEARCH_RADIUS_KM` (mặc định 5km) bằng Haversine → gửi thông báo chuyến mới cho tài xế.
6. Tài xế bấm **"Nhận chuyến"** (postback `ACCEPT_TRIP_<id>`) → `status = accepted`, gắn `driver_id`, `driver.available = false` (dùng transaction + row lock để tránh 2 tài xế cùng nhận 1 chuyến) → gửi thông tin xe/tài xế cho khách.
7. Khi cả khách và tài xế đều xác nhận hoàn thành → `status = completed`, `driver.available = true` trở lại.

## Ghi chú kỹ thuật

- **Distance Matrix**: mặc định dùng [OSRM](https://project-osrm.org/) (miễn phí, tính khoảng cách đường thực tế) qua server demo công cộng, tự động fallback về công thức Haversine (đường chim bay) nếu OSRM lỗi/timeout. Đổi `DISTANCE_PROVIDER=haversine` trong `.env` nếu muốn dùng đường chim bay luôn, hoặc implement thêm Google/Goong Distance Matrix trong `services/distanceService.js` (chỉ cần giữ nguyên chữ ký hàm `getRealDistanceKm`).
- **Map / Autocomplete trong Mini Web App**: dùng Leaflet + OpenStreetMap tile + Nominatim (miễn phí, không cần API key). Có thể thay bằng Google Maps JS API / Mapbox GL / Goong Map nếu cần độ chính xác cao hơn cho production tại Việt Nam.
- Server demo OSRM/Nominatim công cộng có giới hạn tốc độ (rate limit) — phù hợp cho MVP/demo, **không** dùng cho production có lưu lượng lớn. Khi lên production, tự host OSRM hoặc chuyển sang Google/Goong Distance Matrix + Places Autocomplete API.
- Toàn bộ lệnh gọi API ngoài (Messenger Send API, OSRM, Nominatim) và truy vấn Database đều có try-catch; lỗi được log và trả về thông báo thân thiện cho người dùng thay vì crash server.
- Đăng ký tài khoản tài xế (thêm dòng vào bảng `drivers`, gán `role = 'driver'` cho user) chưa có UI trong bản MVP này — có thể thêm qua Admin API hoặc trực tiếp trong DB.
