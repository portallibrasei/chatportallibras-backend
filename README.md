# Chat Portal Libras — Backend (simples)

Arquivos incluídos:
- server.js   -> backend Node.js (Express)
- package.json
- .env.example (exemplo, **não** inclua chaves reais no GitHub)
- service-account.json (seguro, sem chave privada)
- chat.html  -> frontend exemplo (embed)

## Como usar (local)
1. Copie seu arquivo JSON real da Service Account para `service-account.json` **no servidor (não no GitHub)** OR set environment vars (GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY) in your deployment.
2. Edite `.env` a partir de `.env.example`
3. `npm install`
4. `node server.js`
5. Abra `http://localhost:3000` e use os endpoints:
   - POST /api/sync-drive  -> irá listar e baixar PDFs da pasta DO GOOGLE DRIVE cujo ID está em GOOGLE_DRIVE_FOLDER_ID
   - POST /api/chat       -> { question } — responde com trechos encontrados

## Segurança
- **Nunca** envie a chave privada para o GitHub.
- Use variáveis de ambiente ou o secret manager da sua plataforma de deploy.

