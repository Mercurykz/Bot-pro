# Presença Plus (Bot + Server)

Projeto de controle de presença com integração Discord, dividido em dois serviços:

- **Server**: autenticação OAuth, gestão de salas/matérias/sessões e relatórios.
- **Bot**: integração com Discord.

## Estrutura

- `Server/` API web + páginas HTML
- `Bot/` bot Discord
- `.env.example` variáveis de ambiente (template)

## Requisitos

- Node.js 20+
- PostgreSQL (para o Server)
- Aplicação Discord configurada (OAuth + Bot)

## Configuração rápida

1. Copie `.env.example` para `.env`
2. Preencha as variáveis obrigatórias
3. Instale dependências:
   - `npm run install:all`
4. Suba o Server:
   - `npm run start:server`
5. Suba o Bot:
   - `npm run start:bot`

## Observações importantes

- O URL de callback do Discord deve bater exatamente com `CALLBACK_URL`.
- Em produção, prefira store de sessão persistente (Redis/Postgres), não `MemoryStore`.
- Nunca commitar `.env` real.
