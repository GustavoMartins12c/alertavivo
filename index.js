import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(bodyParser.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const GRAPH = "https://graph.facebook.com/v18.0";

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  try {
    await db.query("SELECT 1");
    console.log("🟢 Banco conectado com sucesso");

    await db.query(`
      CREATE TABLE IF NOT EXISTS alertas (
        id SERIAL PRIMARY KEY,
        telefone VARCHAR(20),
        mensagem TEXT,
        criado_em TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'ativo'
      );
    `);

    console.log("🟢 Tabela 'alertas' pronta");
  } catch (error) {
    console.error("🔴 Erro ao inicializar banco:", error);
  }
}

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return res.sendStatus(200);

  const from = msg.from;
  const text = msg.text?.body?.toLowerCase() || "";

  const gatilhos = [
    "alerta",
    "sos",
    "ajuda",
    "socorro",
    "assalto",
    "roubo",
    "acidente",
    "mandei"
  ];

  if (gatilhos.some(g => text.includes(g))) {
    await db.query(
      "INSERT INTO alertas (telefone, mensagem) VALUES ($1, $2)",
      [from, text]
    );

    await enviarMensagem(
      from,
`🚨 ALERTAVIVO ATIVADO

Fique calmo.
Seu alerta foi registrado com sucesso.

🎙️ Fale ao vivo:
https://alertavivo.onrender.com/escuta/${from}

📍 Envie sua localização.`
    );
  }

  res.sendStatus(200);
});

app.get("/admin", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM alertas ORDER BY criado_em DESC LIMIT 100"
    );

    let html = `
      <html>
        <head>
          <title>AlertaVivo - Painel</title>
          <style>
            body { font-family: Arial, sans-serif; background: #0e0e0e; color: #eaeaea; padding: 20px; }
            h1 { color: #ff3b3b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 10px; border-bottom: 1px solid #333; text-align: left; }
            th { background: #1e1e1e; }
            tr:hover { background: #222; }
          </style>
        </head>
        <body>
          <h1>🚨 ALERTAVIVO — PAINEL DE ALERTAS</h1>
          <table>
            <tr>
              <th>ID</th>
              <th>Telefone</th>
              <th>Mensagem</th>
              <th>Data</th>
              <th>Status</th>
            </tr>
    `;

    for (const alerta of result.rows) {
      html += `
        <tr>
          <td>${alerta.id}</td>
          <td>${alerta.telefone}</td>
          <td>${alerta.mensagem}</td>
          <td>${new Date(alerta.criado_em).toLocaleString()}</td>
          <td>${alerta.status}</td>
        </tr>
      `;
    }

    html += `
          </table>
        </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    res.status(500).send("Erro ao carregar painel");
  }
});

async function enviarMensagem(destino, texto) {
  await axios.post(
    `${GRAPH}/${PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: destino,
      text: { body: texto }
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

initDatabase();

app.listen(3000, () => {
  console.log("🛡️ AlertaVivo rodando na porta 3000");
});
