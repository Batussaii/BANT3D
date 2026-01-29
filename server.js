const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080;

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(express.static(path.join(__dirname)));

const buildTransporter = () => {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const getRecipient = () => process.env.SMTP_TO || "InfoBant3d@gmail.com";

const sendMail = async ({ subject, text, html, attachments }) => {
  const transporter = buildTransporter();
  if (!transporter) {
    throw new Error("SMTP no configurado");
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: getRecipient(),
    subject,
    text,
    html,
    attachments,
  });
};

app.post("/api/request", upload.single("attachment"), async (req, res) => {
  try {
    const { name, email, service, budget, details } = req.body;
    const file = req.file;

    const attachments = file
      ? [
          {
            filename: file.originalname,
            path: file.path,
          },
        ]
      : [];

    await sendMail({
      subject: `Nueva solicitud - ${name || "Sin nombre"}`,
      text: `
Nombre: ${name || "-"}
Email: ${email || "-"}
Servicio: ${service || "-"}
Presupuesto: ${budget || "-"}
Detalles: ${details || "-"}
`.trim(),
      html: `
        <h2>Nueva solicitud</h2>
        <p><strong>Nombre:</strong> ${name || "-"}</p>
        <p><strong>Email:</strong> ${email || "-"}</p>
        <p><strong>Servicio:</strong> ${service || "-"}</p>
        <p><strong>Presupuesto:</strong> ${budget || "-"}</p>
        <p><strong>Detalles:</strong><br/>${details || "-"}</p>
      `,
      attachments,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({
      error: error?.message || "No se pudo enviar la solicitud.",
    });
  }
});

app.post("/api/color-request", upload.none(), async (req, res) => {
  try {
    const { product, name, phone, email, color, notes } = req.body;

    await sendMail({
      subject: `Consulta color - ${product || "Producto"}`,
      text: `
Producto: ${product || "-"}
Nombre: ${name || "-"}
Telefono: ${phone || "-"}
Email: ${email || "-"}
Color: ${color || "-"}
Observaciones: ${notes || "-"}
`.trim(),
      html: `
        <h2>Consulta color especial</h2>
        <p><strong>Producto:</strong> ${product || "-"}</p>
        <p><strong>Nombre:</strong> ${name || "-"}</p>
        <p><strong>Telefono:</strong> ${phone || "-"}</p>
        <p><strong>Email:</strong> ${email || "-"}</p>
        <p><strong>Color:</strong> ${color || "-"}</p>
        <p><strong>Observaciones:</strong><br/>${notes || "-"}</p>
      `,
      attachments: [],
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({
      error: error?.message || "No se pudo enviar la consulta.",
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});
