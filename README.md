# Sabe Blefar? — Edição CAOS

Jogo multiplayer de blefe com uma tela de TV e celulares como controles. Requer Node.js 18+ e não depende de serviços externos para iniciar.

## Executar localmente

1. Instale o Node.js 18 ou superior.
2. Extraia a pasta do projeto.
3. Abra o terminal dentro da pasta do projeto.
4. Execute `npm start`.
5. Abra `http://localhost:3000/tv` na tela da TV.
6. Os jogadores entram pelo QR code ou pelo endereço/código mostrado na TV.

Para jogar em uma rede local, TV e celulares devem estar na mesma rede Wi-Fi e acessar o endereço IP local do computador que executa o servidor.

## Publicar no Render usando GitHub

O projeto já está preparado para o Render:

- `render.yaml` define um serviço Web Node.
- `package.json` usa `npm start`.
- `server.js` escuta a porta fornecida pelo Render por meio de `process.env.PORT`.
- A rota `/` responde com a interface dos jogadores e pode ser usada como health check.

Passos:

1. Extraia este ZIP.
2. Envie os arquivos e pastas do projeto para a raiz de um repositório GitHub (não envie a pasta externa que contém o projeto como uma camada extra).
3. No Render, escolha **New + → Blueprint** e conecte o repositório, ou crie um **Web Service** usando:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Aguarde o deploy e abra a URL pública terminada em `/tv` na tela principal.
5. Os jogadores acessam a mesma URL base ou usam o QR code/código exibido na TV.

**Importante:** as salas são mantidas em memória. Se o serviço reiniciar ou entrar em suspensão, as partidas em andamento podem ser perdidas. Este projeto não usa banco de dados nem armazenamento persistente.

## O que mudou na edição CAOS

- Ritmo dinâmico: jogadas têm janelas menores; eventos alteram o relógio.
- Eventos de mesa: eventos surpresa podem alterar recompensas, tempo ou provocar retorno.
- Retorno à partida: o evento Segunda Chance pode trazer um jogador eliminado de volta.
- Poderes especiais: o projeto inclui poderes com efeitos variados.
- TV e celulares: evento ativo aparece nas interfaces; a TV não recebe as mãos dos jogadores.

## Testes

Execute `npm test` para rodar os testes de fluxo da sala, modo Desafio e novas mecânicas da edição CAOS.

## Observações

Esta é uma primeira edição jogável das novas mecânicas. Recomenda-se testar partidas reais e ajustar o balanceamento dos poderes e a frequência dos eventos.
