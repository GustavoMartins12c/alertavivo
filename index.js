import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const GRAPH = "https://graph.facebook.com/v18.0";

// Verificação do webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Recebe mensagens
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
    await enviarMensagem(from,
`🚨 ALERTAVIVO ATIVADO

Fique calmo.
Ajuda está sendo acionada agora.

🎙️ Fale ao vivo:
https://alertavivo.com.br/escuta/${from}

📍 Envie sua localização.`);
  }

  res.sendStatus(200);
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

app.listen(3000, () => {
  console.log("🛡️ AlertaVivo rodando na porta 3000");
});
