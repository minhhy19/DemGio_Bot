import fetch from 'node-fetch';
import dotenv from 'dotenv';
import http from 'http';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import moment from 'moment-timezone';

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const PORT = process.env.PORT || 3000;
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

// Khởi tạo lowdb
const adapter = new JSONFile('db.json');
const db = new Low(adapter, { shifts: {} });

// Khởi tạo server và database
(async () => {
  try {
    // Đọc hoặc khởi tạo database
    await db.read();
    db.data = db.data || { shifts: {} };
    await db.write();

    // Tạo server HTTP
    const server = http.createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            // Log toàn bộ body để debug
            console.log('Body nhận được:', body);
            const update = JSON.parse(body);
            const msg = update.message?.text?.trim() || '';
            const chatId = update.message?.chat?.id;
            const username = update.message?.from?.username || update.message?.from?.first_name || 'Unknown';
            const today = moment().tz(TIME_ZONE).format('YYYY-MM-DD');

            // Log thời gian và tin nhắn
            const now = moment().tz(TIME_ZONE).format('DD/MM/YYYY, HH:mm:ss');
            console.log(`[${now}] Tin nhắn từ ${username}: "${msg}"`);

            // Kiểm tra thứ Bảy/Chủ Nhật
            const dayOfWeek = moment().tz(TIME_ZONE).day(); // 0 = CN, 6 = T7
            if (dayOfWeek === 0) {
              await sendMessage(chatId, '🏖️ Hôm nay Chủ Nhật không làm!');
              return res.end('ok');
            }
            if (dayOfWeek === 6) {
              await sendMessage(chatId, '🏖️ Hôm nay thứ Bảy không làm!');
              return res.end('ok');
            }

            // Xử lý lệnh /ca
            if (msg.startsWith('/ca')) {
              const parts = msg.split(' ');
              if (parts.length < 2 || !/^\d{1,2}:\d{2}$/.test(parts[1])) {
                await sendMessage(chatId, '❗ Dùng: /ca HH:mm (ví dụ: /ca 17:30)');
                return res.end('ok');
              }
              const shiftTime = parts[1];
              db.data.shifts[today] = db.data.shifts[today] || {};
              db.data.shifts[today][username] = shiftTime;
              await db.write();
              await sendMessage(chatId, `✅ Đã lưu giờ chốt ca của bạn là ${shiftTime}`);
              return res.end('ok');
            }

            // Xử lý lệnh /giove
            if (msg === '/giove') {
              const shiftTime = db.data.shifts[today]?.[username];
              if (!shiftTime) {
                await sendMessage(chatId, '⚠️ Bạn chưa đặt giờ chốt ca hôm nay.');
                return res.end('ok');
              }
              const [h, m] = shiftTime.split(':').map(Number);
              
              // Lấy thời gian hiện tại theo múi giờ VN
              const now = moment().tz(TIME_ZONE);
              // Tạo thời gian chốt ca trong múi giờ VN
              const shiftDate = moment.tz(
                `${now.format('YYYY-MM-DD')} ${shiftTime}`,
                'YYYY-MM-DD HH:mm',
                TIME_ZONE
              );
              // Tính chênh lệch thời gian (phút)
              const diff = shiftDate.diff(now, 'minutes');

              if (diff <= 0) {
                await sendMessage(chatId, '🎉 Đã tới giờ về rồi!');
                return res.end('ok');
              }

              const hours = Math.floor(diff / 60);
              const minutes = diff % 60;
              await sendMessage(chatId, `⏳ Còn khoảng ${hours} giờ ${minutes} phút nữa là tới giờ về (${shiftTime})`);
              return res.end('ok');
            }

            // Xử lý các lệnh/tin nhắn khác
            await sendMessage(chatId, `ℹ️ Lệnh "${msg}" không được nhận diện. Dùng /ca HH:mm hoặc /giove.`);
            console.log(`[${now}] Lệnh không nhận diện: "${msg}"`);
            return res.end('ok');
          } catch (error) {
            console.error('Lỗi xử lý yêu cầu:', error);
            res.end('error');
          }
        });
      } else {
        res.end('ok');
      }
    });

    // Khởi động server
    server.listen(PORT, () => console.log(`Bot đang chạy trên cổng ${PORT}`));

    // Hàm gửi tin nhắn
    async function sendMessage(chatId, text) {
      try {
        const response = await fetch(`${API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
        console.log(`Gửi tin nhắn tới ${chatId}: ${text}`);
        return await response.json();
      } catch (error) {
        console.error('Lỗi gửi tin nhắn:', error);
      }
    }

    // Thiết lập webhook
    async function setWebhook() {
      try {
        const webhookUrl = process.env.WEBHOOK_URL || 'YOUR_NGROK_URL';
        const response = await fetch(`${API}/setWebhook?url=${webhookUrl}`);
        const result = await response.json();
        console.log('Webhook thiết lập:', result);
      } catch (error) {
        console.error('Lỗi thiết lập webhook:', error);
      }
    }

    if (process.env.WEBHOOK_URL) {
      await setWebhook();
    } else {
      console.warn('Chưa có WEBHOOK_URL trong .env. Chạy ngrok và thiết lập webhook thủ công.');
    }

  } catch (error) {
    console.error('Lỗi khởi tạo:', error);
  }
})();