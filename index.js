import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(bodyParser.json());

// ===============================
// CONFIGURAÇÕES
// ===============================
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const GRAPH = "https://graph.facebook.com/v18.0";

// ===============================
// CONEXÃO COM O BANCO (POSTGRES)
// ===============================
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===============================
// INICIALIZAÇÃO DO BANCO
// ===============================
async function initDatabase() {
  try {
    // Testa conexão
    await db.query("SELECT 1");
    console.log("🟢 Banco conectado com sucesso");

    // Cria tabela se não existir
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

// ===============================
// WEBHOOK - VERIFICAÇÃO (META)
// ===============================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ===============================
// WEBHOOK - RECEBER MENSAGENS
// ===============================
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

    // Salva alerta no banco
    await db.query(
      "INSERT INTO alertas (telefone, mensagem) VALUES ($1, $2)",
      [from, text]
    );

    // Responde ao usuário
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

// ===============================
// FUNÇÃO PARA ENVIAR MENSAGEM
// ===============================
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

// ===============================
// INICIALIZA E SOBE O SERVIDOR
// ===============================
initDatabase();

app.listen(3000, () => {
  console.log("🛡️ AlertaVivo rodando na porta 3000");
});
