import fetch from 'node-fetch';
import dotenv from 'dotenv';
import http from 'http';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const PORT = process.env.PORT || 3000;

// Lowdb setup
const adapter = new JSONFile('db.json');
const db = new Low(adapter);
await db.read();
db.data ||= { shifts: {} };

// Gửi tin nhắn
async function sendMessage(chatId, text) {
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// Server Telegram Webhook
http.createServer(async (req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const update = JSON.parse(body);
      const msg = update.message?.text || '';
      const chatId = update.message.chat.id;
      const username = update.message.from.username || update.message.from.first_name;
      const today = new Date().toISOString().split('T')[0];

      if (msg.startsWith('/ca')) {
        const parts = msg.split(' ');
        if (parts.length < 2 || !/^\d{1,2}:\d{2}$/.test(parts[1])) {
          await sendMessage(chatId, '❗ Sai định dạng. Dùng: /ca HH:mm (ví dụ: /ca 17:30)');
        } else {
          const shiftTime = parts[1];
          db.data.shifts[today] ||= {};
          db.data.shifts[today][username] = shiftTime;
          await db.write();
          await sendMessage(chatId, `✅ Đã lưu giờ chốt ca của bạn là ${shiftTime}`);
        }
      } else if (msg === '/giove') {
        const shiftTime = db.data.shifts[today]?.[username];
        if (!shiftTime) {
          await sendMessage(chatId, '⚠️ Bạn chưa đặt giờ chốt ca hôm nay. Dùng lệnh: /ca HH:mm');
        } else {
          const [h, m] = shiftTime.split(':').map(Number);
          const now = new Date();
          const shiftDate = new Date(now);
          shiftDate.setHours(h, m, 0, 0);

          const diffMs = shiftDate - now;
          if (diffMs <= 0) {
            await sendMessage(chatId, '🎉 Đã tới giờ về rồi!');
          } else {
            const mins = Math.floor(diffMs / 1000 / 60);
            const hours = Math.floor(mins / 60);
            const remainingMinutes = mins % 60;
            await sendMessage(chatId, `⏳ Còn khoảng ${hours} giờ ${remainingMinutes} phút nữa là tới giờ về (${shiftTime})`);
          }
        }
      }

      res.end('ok');
    });
  } else {
    res.end('ok');
  }
}).listen(PORT, () => console.log(`Bot is running on port ${PORT}`));
