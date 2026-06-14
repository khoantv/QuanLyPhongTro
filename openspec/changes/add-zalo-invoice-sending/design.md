## Context

Hệ thống hiện tại (Next.js 15 + MongoDB + NextAuth) đã có flow tạo hóa đơn (`POST /api/hoa-don`), lưu trong collection `hoadons`, render UI ở `/dashboard/hoa-don`. Tuy nhiên việc thông báo cho khách thuê hoàn toàn thủ công.

Stakeholders:
- **Chủ trọ / admin**: muốn giảm thao tác nhắc tiền, có cấu hình rõ ràng, log đầy đủ để truy vết
- **Khách thuê**: nhận tin Zalo card hóa đơn, bấm CTA xác nhận thanh toán
- **Đội vận hành (sau này)**: cần khả năng debug khi tin gửi fail (xem log, resend)

Ràng buộc:
- **Zalo OA API**: chỉ gửi tin được cho user đã "quan tâm" OA; có rate limit theo hạng OA; chỉ cho phép gửi tin proactive trong khung 6h-22h; mỗi tin có thể phát sinh phí tùy gói
- **Vercel**: serverless, không có background worker thường trú → phải dùng Vercel Cron hoặc external cron để retry
- **Token**: Zalo access_token hết hạn sau ~25h → cần refresh, share giữa các serverless instance
- **Privacy**: số điện thoại khách + nội dung hóa đơn là PII → log không expose ra public
- **Hiện tại không có queue infra** (Redis / SQS) → dùng MongoDB như queue đơn giản

## Goals / Non-Goals

**Goals:**

- Cho phép chủ trọ cấu hình 1 lần và mỗi hóa đơn mới tự động gửi Zalo cho khách
- Có trang lịch sử với filter theo tháng/phòng/status để debug
- Service Zalo tách riêng (`src/lib/zalo`) — dễ test, dễ swap sang provider khác nếu cần
- Triển khai tăng dần qua 3 milestone M1/M2/M3 để có thể release từng phần
- Không phá flow tạo hóa đơn hiện hữu — nếu Zalo lỗi, hóa đơn vẫn tạo OK

**Non-Goals:**

- Không tích hợp 2 chiều phức tạp (chat realtime, bot reply tự động) — chỉ outbound + log inbound
- Không tích hợp ZNS (Zalo Notification Service — kênh có phí cao hơn, template duyệt phức tạp) trong giai đoạn này; dùng OA message
- Không xây UI cho khách thuê thanh toán in-app (CTA chỉ link tới trang public hiện hữu)
- Không hỗ trợ multi-OA (1 chủ trọ chỉ link 1 Zalo OA)
- Không build queue worker dedicated — dùng MongoDB collection + Vercel Cron

## Decisions

### 1. Zalo OA Message API thay vì ZNS

**Chọn**: Zalo Official Account Message API (`openapi.zalo.me/v3.0/oa/message/...`)

**Lý do**:
- ZNS yêu cầu duyệt template cho từng business case, phí cao hơn, chỉ dành cho notification chuẩn hóa
- OA Message cho phép template `consultation_request` với card layout phong phú, miễn phí trong giới hạn
- Khách phải follow OA — đây cũng là cơ hội tạo "fanbase" cho chủ trọ

**Alternatives**:
- ZNS: chi phí và độ phức tạp duyệt template cao — để giai đoạn sau nếu cần
- SMS: đắt hơn, không có card UI, kém engagement
- Email: dùng được nhưng tỷ lệ mở thấp ở VN với target khách thuê trẻ

### 2. MongoDB collection làm queue

**Chọn**: Collection `ZaloMessageLog` đóng đồng thời 2 vai trò: log lịch sử + queue cho retry

**Lý do**:
- Không cần thêm infra (Redis/SQS) → giảm độ phức tạp triển khai và chi phí
- Vercel Cron mỗi 5 phút quét entries `status in ['queued','failed']` với `nextRetryAt <= now` là đủ throughput cho quy mô vài trăm hóa đơn/ngày
- Cùng collection — query lịch sử và query queue là 2 use case của cùng dataset

**Alternatives**:
- BullMQ + Redis (Upstash): phức tạp hơn, tốn 1 dịch vụ ngoài; chỉ đáng khi >1000 msg/phút
- AWS SQS/SNS: vendor lock, latency với serverless cao
- Inngest: tốt nhưng vendor mới, tránh thêm SaaS ở giai đoạn này

### 3. Access token refresh với memory cache + DB fallback

**Chọn**: Cache token trong process memory + lưu vào collection `ZaloOAToken` (singleton). Nếu cache miss → đọc DB; nếu DB cũng expired → refresh.

**Lý do**:
- Vercel serverless: mỗi cold start có process mới → cần shared store
- Token live ~25h → cache memory hiệu quả trong 1 process; DB là source of truth cross-instance
- Tránh việc 2 instance cùng refresh dẫn đến token race — dùng `findOneAndUpdate` với version/timestamp guard

**Alternatives**:
- Chỉ env var: phải redeploy khi refresh — không khả thi
- Chỉ DB không cache: thêm 1 query mỗi lần gửi tin — acceptable nhưng không tối ưu

### 4. Hook async sau khi tạo hóa đơn (fire-and-forget)

**Chọn**: Trong `POST /api/hoa-don`, sau `await hoaDon.save()`, gọi `void zalo.sendInvoiceMessage(...)` (không await) và trả response ngay.

**Lý do**:
- Tránh kéo dài response time của API tạo hóa đơn vì Zalo có thể chậm
- Lỗi Zalo không nên rollback hóa đơn — đã có log để retry

**Alternatives**:
- Await và return cả status Zalo: response chậm, UX kém
- Dùng API route khác để gọi từ client sau khi tạo hóa đơn: phụ thuộc client trigger, rủi ro miss

**Rủi ro**: Trong serverless, "fire-and-forget" có thể bị kill khi response trả về.
**Mitigation**: Dùng `waitUntil` của Vercel (`@vercel/functions`) để giữ process sống tới khi promise xong. Nếu không có, tạo entry log với status=`queued` ngay → cron sẽ pick up.

### 5. Khung giờ check ở service layer, không ở caller

**Chọn**: Hàm `sendInvoiceMessage` tự check `isWithinAllowedHours()` — nếu out of hours → tạo log status=`queued`, retryAt = giờ hợp lệ kế tiếp; nếu in hours → gọi Zalo API.

**Lý do**:
- Đóng gói rule kinh doanh vào service → caller không cần biết
- Cron retry và auto-send dùng chung 1 entry point

### 6. Webhook signature verification bắt buộc

**Chọn**: Verify `X-ZEvent-Signature` (HMAC SHA-256 của raw body + secret key) trước khi parse payload. Sai → 401.

**Lý do**: Webhook public — không verify → ai cũng có thể fake event `follow`/`user_send_text`.

### 7. Singleton `CaiDatHoaDon` upsert pattern

**Chọn**: Mọi GET/PUT đều thao tác qua `findOneAndUpdate({ singleton: true }, ..., { upsert: true, new: true })` với key cố định `singleton: true`.

**Lý do**: Đơn giản, không cần collection chỉ chứa 1 row với ID hardcoded; mongo tự lo concurrency.

### 8. Template render bằng helper TS thuần, không template engine

**Chọn**: 1 file `src/lib/zalo/template.ts` export `renderInvoiceCard(hoaDon, khachThue, settings)` trả về object payload Zalo.

**Lý do**:
- Template thuần data → object — không có HTML/Markdown phức tạp → không cần Handlebars/EJS
- Type-safe, dễ test với fixtures

## Risks / Trade-offs

- **[Token Zalo expired đồng thời với traffic peak]** → Mitigation: implement refresh trong service với mutex-via-DB; cảnh báo nếu refresh fail trong 1h liên tục
- **[Vercel Cron chỉ chạy 1 lần/ngày trên Hobby]** → Mitigation: doc rõ trong README; nếu user dùng Hobby thì retry 1 lần/ngày là chấp nhận được; khuyến nghị upgrade Pro nếu cần realtime
- **[Khách chưa follow OA → nhiều tin failed]** → Mitigation: trang Khách thuê có chỉ báo "Chưa quan tâm OA" + UI gửi link mời; status `skipped` không gây alert
- **[Zalo thay đổi template chính sách]** → Mitigation: template tách thành 1 file riêng, dễ swap; có alert khi tỷ lệ failed > 30% trong 1h
- **[Race condition khi cron + auto-send cùng gửi 1 hóa đơn]** → Mitigation: trước khi gửi, set log entry với unique index `(hoaDonId, trigger)` hoặc kiểm tra log gần nhất; nếu đã có entry status=`sent` trong 5 phút → skip
- **[PII leak qua log requestPayload]** → Mitigation: redact số điện thoại trong log nếu lưu lâu hạn; rotation log >90 ngày
- **[Cost — mỗi tin Zalo có thể tốn phí]** → Mitigation: hiển thị warning trong UI cài đặt; admin có thể tắt master switch bất cứ lúc nào

## Migration Plan

**M1 — Settings + manual send (1-2 ngày)**:
1. Tạo model `CaiDatHoaDon`, `ZaloMessageLog`, `ZaloOAToken`
2. API CRUD cấu hình + trang `/dashboard/cai-dat-hoa-don`
3. Service `src/lib/zalo/` (client + template + time-gate)
4. API `POST /api/zalo/send-invoice` (manual + preview)
5. Modal preview UI điện thoại
6. Sidebar link

**M2 — History page (1 ngày)**:
1. Trang `/dashboard/zalo-history` với filter
2. API `GET /api/zalo/logs?year&month&phong&status&page`
3. Nút Resend
4. Modal chi tiết tin

**M3 — Auto-send + cron + webhook (1-2 ngày)**:
1. Thêm `zaloUserId` + `daQuanTamOA` vào `KhachThue`
2. Hook auto-send trong `POST /api/hoa-don`
3. `POST /api/zalo/retry` + Vercel cron 5 phút/lần
4. `POST /api/zalo/webhook` + signature verify
5. UI hiển thị badge "Chưa quan tâm OA" + nút sao chép link mời

**Rollback**:
- Master switch `autoSendZalo=false` tắt auto-send ngay lập tức
- Webhook và cron có thể disable bằng cách xóa entry trong `vercel.json`
- Collection `ZaloMessageLog` có thể giữ làm history, không cần xóa khi rollback

## Open Questions

- **Có cần hỗ trợ 1 chủ trọ nhiều OA (vd: nhiều tòa nhà riêng OA)?** → Đề xuất: KHÔNG ở M1-M3; nếu cần thì v2 lưu OA per `ToaNha`
- **CTA "Xác nhận thanh toán" trên Zalo card link đến đâu?** → Đề xuất: `/hoa-don/[id]` (đã có route public hiện hữu); cần kiểm tra trang có hiển thị nút thanh toán hay không
- **Có cần tách "Cài đặt phiếu thu" khỏi "Cài đặt Zalo" thành 2 trang riêng?** → Đề xuất: theo ảnh người dùng → gộp 1 trang để giảm clutter; có thể tách sau nếu trang dài
- **Có cần ghi audit log ai bật/tắt master switch?** → Đề xuất: M2 thêm nếu rảnh; không phải blocker
