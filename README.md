# Sabe Blefar? — TV + celulares

Requisitos: Node 18 ou mais novo. Não precisa instalar nada (`npm install` não é necessário).

## Jogar em casa (mesmo Wi-Fi)
1. Na pasta do projeto: `node server.js`
2. No computador ligado à TV (HDMI ou navegador da smart TV), abra `http://IP-DO-COMPUTADOR:3000/tv`
   (descubra o IP: `ipconfig` no Windows, `ifconfig`/`ip a` no Mac/Linux, ex.: 192.168.0.15).
3. Cada pessoa escaneia o QR code da TV, ou abre `http://IP-DO-COMPUTADOR:3000` e digita o código de 4 letras.
4. O primeiro a entrar é o host: ele escolhe o total de jogadores (bots completam) e toca em "Começar partida".

## Colocar na internet (qualquer um joga de qualquer lugar)
Hospede em Render, Railway ou Fly.io como "Web Service" Node:
- Build command: (vazio) · Start command: `node server.js`
- Eles já dão HTTPS e definem a variável PORT sozinhos.
- TV: `https://seu-app.onrender.com/tv` · Celulares: `https://seu-app.onrender.com`
Importante: rode uma única instância (as salas ficam na memória do servidor).

## Teste automático
`node test.js` joga uma partida inteira em modo acelerado e confere as regras de conexão.

## Arquivos
- `engine.js`: regras, bots, timers (o servidor decide tudo)
- `server.js`: HTTP + tempo real (SSE) + salas
- `public/tv.html`, `public/play.html`, `public/style.css`, `public/common.js`: telas

## Limitações conhecidas
- Salas ficam na memória: se o servidor reiniciar, as salas somem.
- Modo em duplas e tutorial ainda não foram portados do protótipo.
