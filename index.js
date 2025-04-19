import fetch from 'node-fetch';
import dotenv from 'dotenv';
import http from 'http';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const PORT = process.env.PORT || 3000;

// Khởi tạo lowdb
const adapter = new JSONFile('db.json');
const db = new Low(adapter, { shifts: {} });

// Khởi tạo dữ liệu mặc định
(async () => {
  try {
    // Đọc dữ liệu từ db.json
    await db.read();
    
    // Nếu db.data không tồn tại, khởi tạo mặc định
    db.data = db.data || { shifts: {} };
    
    // Ghi dữ liệu mặc định vào file nếu cần
    await db.write();

    // Khởi động server
    http.createServer(async (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const update = JSON.parse(body);
            const msg = update.message?.text || '';
            const chatId = update.message.chat.id;
            const username = update.message.from.username || update.message.from.first_name;
            const today = new Date().toISOString().split('T')[0];

            // Log thời gian và nội dung tin nhắn
            console.log('update', update);
            const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
            console.log(`[${now}] Tin nhắn từ ${username}: ${msg}`);

            if (msg.startsWith('/ca')) {
              const parts = msg.split(' ');
              if (parts.length < 2 || !/^\d{1,2}:\d{2}$/.test(parts[1])) {
                return sendMessage(chatId, '❗ Dùng: /ca HH:mm (ví dụ: /ca 17:30)');
              }
              const shiftTime = parts[1];
              db.data.shifts[today] = db.data.shifts[today] || {};
              db.data.shifts[today][username] = shiftTime;
              await db.write();
              return sendMessage(chatId, `✅ Đã lưu giờ chốt ca của bạn là ${shiftTime}`);
            }

            if (msg === '/giove') {
              const shiftTime = db.data.shifts[today]?.[username];
              if (!shiftTime) {
                return sendMessage(chatId, '⚠️ Bạn chưa đặt giờ chốt ca hôm nay.');
              }
              const [h, m] = shiftTime.split(':').map(Number);
              const now = new Date();
              const shiftDate = new Date();
              shiftDate.setHours(h, m, 0, 0);
              const diff = shiftDate - now;

              if (diff <= 0) return sendMessage(chatId, '🎉 Đã tới giờ về rồi!');

              const mins = Math.floor(diff / 60000);
              const hours = Math.floor(mins / 60);
              const minutes = mins % 60;
              return sendMessage(chatId, `⏳ Còn khoảng ${hours} giờ ${minutes} phút nữa là tới giờ về (${shiftTime})`);
            }

            res.end('ok');
          } catch (error) {
            console.error('Lỗi xử lý yêu cầu:', error);
            res.end('error');
          }
        });
      } else {
        res.end('ok');
      }
    }).listen(PORT, () => console.log(`Bot đang chạy trên cổng ${PORT}`));

    async function sendMessage(chatId, text) {
      try {
        await fetch(`${API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
      } catch (error) {
        console.error('Lỗi gửi tin nhắn:', error);
      }
    }
  } catch (error) {
    console.error('Lỗi khởi tạo database:', error);
  }
})();