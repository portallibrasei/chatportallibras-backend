import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import pdf from 'pdf-parse';
import fetch from 'node-fetch';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
// load credentials from service-account.json (safe placeholder) or from env
let credentials = null;
const svcPath = path.join(process.cwd(), 'service-account.json');
if (fs.existsSync(svcPath)) {
  try { credentials = JSON.parse(fs.readFileSync(svcPath, 'utf8')); } catch(e){ credentials = null; }
}
if (!credentials && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
  credentials = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  };
}

function getDriveClient(){
  if(!credentials) throw new Error('Google service account credentials not provided. Put service-account.json (safe) or set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in .env');
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

async function downloadFileToTemp(drive, fileId, outPath){
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(outPath);
    res.data.pipe(dest);
    res.data.on('end', resolve);
    res.data.on('error', reject);
  });
}

async function extractTextFromPdfPath(filePath){
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text || '';
}

// Simple in-memory "index" (not persistent) — stores chunks as {id, filename, chunk}
let indexDB = [];

// Endpoint: sync drive (downloads PDFs from DRIVE_FOLDER_ID and indexes)
app.post('/api/sync-drive', async (req, res) => {
  try{
    if(!DRIVE_FOLDER_ID) return res.status(400).json({ error: 'GOOGLE_DRIVE_FOLDER_ID not set in .env' });
    const drive = getDriveClient();
    const q = `'${DRIVE_FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false`;
    const list = await drive.files.list({ q, fields: 'files(id,name,modifiedTime)', pageSize: 1000 });
    const files = list.data.files || [];
    let counted = 0;
    const tmpDir = path.join(process.cwd(), 'tmp');
    if(!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    for(const f of files){
      const outPath = path.join(tmpDir, f.id + '.pdf');
      await downloadFileToTemp(drive, f.id, outPath);
      const text = await extractTextFromPdfPath(outPath);
      // naive chunking by 2000 chars
      for(let i=0;i<text.length;i+=1800){
        const chunk = text.slice(i, i+1800);
        indexDB.push({ id: `${f.id}_${i}`, filename: f.name, chunk });
      }
      counted++;
      try{ fs.unlinkSync(outPath); }catch(e){}
    }
    res.json({ ok:true, indexedFiles: counted, indexedChunks: indexDB.length });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint: chat — will search naive substring match and return context
app.post('/api/chat', async (req, res) => {
  try{
    const { question } = req.body;
    if(!question) return res.status(400).json({ error: 'question required' });
    // simple relevance: chunks containing any word from question
    const q = question.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = indexDB.filter(item => q.some(w => item.chunk.toLowerCase().includes(w))).slice(0,5);
    const context = matches.map(m=>({ filename: m.filename, excerpt: m.chunk.slice(0,400) }));
    // For demo we just return matched excerpts. In production you'd call an LLM here.
    return res.json({ answer: `Encontrei ${matches.length} trecho(s). Veja os excertos e pergunte algo mais específico.`, context });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.send('Chat Portal Libras - backend simples'));

app.listen(PORT, () => console.log('Server running on port', PORT));
