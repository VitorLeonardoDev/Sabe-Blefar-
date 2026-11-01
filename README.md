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

## Som
A TV toca músicas e efeitos (`public/audio.js`). Navegadores só liberam áudio depois de um toque/tecla: **toque uma vez na tela da TV** (ou aperte qualquer tecla) para ativar. O botão no canto alterna mudo.
Coloque os arquivos em `public/audio/` (nomes e detalhes em `public/audio/LEIA-ME.txt`): `lobby`, `game`, `challenge`, `tick`, `whoosh`, `flash`, `boom`, `win` (mp3/ogg/m4a/wav). O que faltar toca um som sintetizado.

## Modo Desafio
Quem tem **menos pontos** que um jogador com **8 ou 9 pontos** pode desafiá-lo (botão no celular). O jogo pausa: o desafiado esconde 5 números de 1 a 10 e o desafiante tem 5 palpites para acertar 3. Acertou: desafiante +3 e desafiado −3. Errou: desafiante −3 e desafiado +3 (chega a 10 e vence). Ajuste as regras nas constantes `CH_*` no topo de `engine.js` (com `CH_TRIES = 3` os 3 palpites precisam todos estar certos).

## Teste automático
`npm test` joga uma partida inteira em modo acelerado, confere as regras de conexão e testa o modo Desafio (`test-challenge.js`).

## Arquivos
- `engine.js`: regras, bots, timers (o servidor decide tudo)
- `server.js`: HTTP + tempo real (SSE) + salas
- `public/tv.html`, `public/play.html`, `public/style.css`, `public/common.js`: telas

## Limitações conhecidas
- Salas ficam na memória: se o servidor reiniciar, as salas somem.
- Modo em duplas e tutorial ainda não foram portados do protótipo.

## Poderes (Modo poderes: o host liga ou desliga no lobby)
Cada jogador começa com 1 poder e ganha mais 1 ao acusar certo (máximo 2 na mão). Só 1 poder por vez, usado na sua vez.
- 👁️ Espiar: vê a carta virada da última jogada (só no seu celular)
- 🔒 Mordaça: escolhe quem não poderá acusar a sua próxima jogada
- 🎯 Radar: revela na TV se a última jogada foi blefe (custa 1 ponto)
- 🛡️ Escudo: anula a sua próxima perda de pontos
- 🃏 Carta dourada: a sua próxima carta conta como verdade
- 🔕 Passe livre: dispensa uma acusação obrigatória
- 🎲 Aposta dobrada: o seu próximo blefe vale +4 (ou −4 se for pego)
- 🔄 Troca: troca uma carta da mão por outra do baralho
- 🎡 Nova referência: sorteia outra carta de referência
Quem tem 8 ou 9 pontos não pode usar Espiar, Mordaça nem Radar. Poderes públicos (Mordaça, Radar, Passe livre, Nova referência) aparecem na TV com o nome; os outros aparecem como "poder secreto".

## Remover jogador
O host vê "Remover jogador" no celular (no lobby e durante a partida). Quem é removido sai da partida e não consegue voltar com o mesmo celular. Jogadores desconectados passam a ter só 6 segundos por vez, para não travar a mesa.

## Testes
`node test.js` · `node test-challenge.js` · `node test-powers.js`
