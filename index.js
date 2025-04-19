import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

async function startBot() {
  const res = await fetch(`${API}/getMe`);
  const botInfo = await res.json();
  console.log('Bot started:', botInfo.result.username);
}

startBot();

// Simple webhook listener (for production deploy)
import http from 'http';
const PORT = process.env.PORT || 3000;

http.createServer(async (req, res) => {
    try {
        if (req.method === 'POST') {
            let body = '';
        
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
              const update = JSON.parse(body);
              console.log('Update received:', update);
              const chatId = update.message.chat.id;
              const message = update.message.text;
        
              await fetch(`${API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `You said: ${message}`
                })
              });
        
              res.end('ok');
            });
          } else {
            res.end('hello');
          }
    } catch (error) {
        console.log('Error:', error);
    }
}).listen(PORT, () => console.log(`Server is running on port ${PORT}`));
