const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");
const multer = require("multer");
const nodemailer = require("nodemailer");
const paypal = require("@paypal/checkout-server-sdk");
const stripeFactory = require("stripe");
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
const DEFAULT_CURRENCY = process.env.CHECKOUT_CURRENCY || "EUR";
const stripe =
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "changeme"
    ? stripeFactory(process.env.STRIPE_SECRET_KEY)
    : null;

const buildPayPalClient = () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const env = process.env.PAYPAL_ENV === "live";
  const environment = env
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);
  return new paypal.core.PayPalHttpClient(environment);
};

const getBaseUrl = (req) => `${req.protocol}://${req.get("host")}`;

const normalizeItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      name: typeof item?.name === "string" ? item.name.trim() : "",
      description: typeof item?.description === "string" ? item.description.trim() : "",
      price: Number(item?.price) || 0,
      qty: Number(item?.qty) || 0,
    }))
    .filter((item) => item.name && item.price > 0 && item.qty > 0);
};

const processedPayments = new Set();

const formatMoney = (value, currency = DEFAULT_CURRENCY) =>
  `${Number(value || 0).toFixed(2)} ${currency}`;

const sendOrderEmail = async ({ source, providerId, currency, total, items }) => {
  if (!items.length) return;
  if (providerId && processedPayments.has(providerId)) return;
  if (providerId) processedPayments.add(providerId);

  const totalValue =
    Number(total) ||
    items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const orderLines = items
    .map(
      (item) =>
        `- ${item.name}${item.description ? ` (${item.description})` : ""} x${
          item.qty
        } -> ${formatMoney(item.price, currency)}`
    )
    .join("\n");

  await sendMail({
    subject: `Pedido pagado (${source || "pasarela"})`,
    text: `
Metodo: ${source || "-"}
Referencia: ${providerId || "-"}
Moneda: ${currency || DEFAULT_CURRENCY}
Total: ${formatMoney(totalValue, currency)}

Productos:
${orderLines}
    `.trim(),
    html: `
      <h2>Pedido pagado</h2>
      <p><strong>Metodo:</strong> ${source || "-"}</p>
      <p><strong>Referencia:</strong> ${providerId || "-"}</p>
      <p><strong>Moneda:</strong> ${currency || DEFAULT_CURRENCY}</p>
      <p><strong>Total:</strong> ${formatMoney(totalValue, currency)}</p>
      <h3>Productos</h3>
      <ul>
        ${items
          .map(
            (item) =>
              `<li>${item.name}${
                item.description ? ` (${item.description})` : ""
              } x${item.qty} -> ${formatMoney(item.price, currency)}</li>`
          )
          .join("")}
      </ul>
    `,
    attachments: [],
  });
};

const getPayPalBaseUrl = () =>
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const requestJson = (url, { method = "GET", headers = {}, body } = {}) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        let parsed = null;
        if (data) {
          try {
            parsed = JSON.parse(data);
          } catch (error) {
            parsed = null;
          }
        }
        resolve({ status: res.statusCode || 500, data: parsed });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });

const getPayPalAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const params = new URLSearchParams({ grant_type: "client_credentials" });
  const response = await requestJson(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (response.status >= 400) return null;
  return response.data?.access_token || null;
};

const verifyPayPalWebhook = async (req) => {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return false;

  const payload = {
    auth_algo: req.get("paypal-auth-algo"),
    cert_url: req.get("paypal-cert-url"),
    transmission_id: req.get("paypal-transmission-id"),
    transmission_sig: req.get("paypal-transmission-sig"),
    transmission_time: req.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: req.body,
  };

  const response = await requestJson(
    `${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return response.data?.verification_status === "SUCCESS";
};

const fetchPayPalOrder = async (orderId) => {
  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return null;
  const response = await requestJson(
    `${getPayPalBaseUrl()}/v2/checkout/orders/${orderId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (response.status >= 400) return null;
  return response.data || null;
};

app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !webhookSecret) {
      res.status(500).send("Stripe no configurado");
      return;
    }
    const signature = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const sessionId = session.id;
      if (processedPayments.has(sessionId)) {
        res.json({ received: true });
        return;
      }
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
        limit: 100,
      });
      const items = (lineItems?.data || []).map((item) => ({
        name: item.description || "Producto",
        description: "",
        price: (item.price?.unit_amount || 0) / 100,
        qty: item.quantity || 1,
      }));
      await sendOrderEmail({
        source: "stripe",
        providerId: sessionId,
        currency: (session.currency || DEFAULT_CURRENCY).toUpperCase(),
        total: (session.amount_total || 0) / 100,
        items,
      });
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).send(`Webhook error: ${error?.message || "Error"}`);
  }
});

app.use(express.json());

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

app.post("/api/checkout/stripe", async (req, res) => {
  try {
    if (!stripe) {
      res.status(500).json({ error: "Stripe no está configurado." });
      return;
    }
    const items = normalizeItems(req.body?.items);
    if (!items.length) {
      res.status(400).json({ error: "No hay productos para cobrar." });
      return;
    }

    const currency = (req.body?.currency || DEFAULT_CURRENCY).toLowerCase();
    const baseUrl = getBaseUrl(req);
    const successUrl = req.body?.successUrl || `${baseUrl}/tienda.html?payment=success`;
    const cancelUrl = req.body?.cancelUrl || `${baseUrl}/tienda.html?payment=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: items.map((item) => ({
        price_data: {
          currency,
          product_data: {
            name: item.name,
            description: item.description || undefined,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.qty,
      })),
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    res.status(500).json({
      error: error?.message || "No se pudo iniciar el pago con tarjeta.",
    });
  }
});

app.post("/api/checkout/paypal", async (req, res) => {
  try {
    const client = buildPayPalClient();
    if (!client) {
      res.status(500).json({ error: "PayPal no está configurado." });
      return;
    }
    const items = normalizeItems(req.body?.items);
    if (!items.length) {
      res.status(400).json({ error: "No hay productos para cobrar." });
      return;
    }

    const currency = (req.body?.currency || DEFAULT_CURRENCY).toUpperCase();
    const baseUrl = getBaseUrl(req);
    const returnUrl = req.body?.successUrl || `${baseUrl}/tienda.html?payment=success`;
    const cancelUrl = req.body?.cancelUrl || `${baseUrl}/tienda.html?payment=cancel`;
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: total.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: currency,
                value: total.toFixed(2),
              },
            },
          },
          items: items.map((item) => ({
            name: item.name,
            description: item.description || undefined,
            unit_amount: {
              currency_code: currency,
              value: item.price.toFixed(2),
            },
            quantity: item.qty.toString(),
          })),
        },
      ],
      application_context: {
        brand_name: "Bant3D",
        landing_page: "LOGIN",
        user_action: "PAY_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    });

    const response = await client.execute(request);
    const approve = response?.result?.links?.find((link) => link.rel === "approve");
    if (!approve?.href) {
      res.status(500).json({ error: "No se pudo generar el enlace de PayPal." });
      return;
    }

    res.json({ url: approve.href, orderId: response?.result?.id });
  } catch (error) {
    res.status(500).json({
      error: error?.message || "No se pudo iniciar el pago con PayPal.",
    });
  }
});

app.post("/webhooks/paypal", async (req, res) => {
  try {
    const verified = await verifyPayPalWebhook(req);
    if (!verified) {
      res.status(400).send("Webhook no verificado");
      return;
    }

    const eventType = req.body?.event_type || "";
    if (eventType !== "PAYMENT.CAPTURE.COMPLETED") {
      res.json({ received: true });
      return;
    }

    const resource = req.body?.resource || {};
    const relatedOrderId = resource?.supplementary_data?.related_ids?.order_id;
    const orderId = relatedOrderId || resource?.id;
    if (!orderId) {
      res.json({ received: true });
      return;
    }

    const order = await fetchPayPalOrder(orderId);
    if (!order) {
      res.json({ received: true });
      return;
    }

    const currency = order.purchase_units?.[0]?.amount?.currency_code || DEFAULT_CURRENCY;
    const total = Number(order.purchase_units?.[0]?.amount?.value || 0);
    const items =
      order.purchase_units?.flatMap((unit) =>
        (unit.items || []).map((item) => ({
          name: item.name || "Producto",
          description: item.description || "",
          price: Number(item.unit_amount?.value || 0),
          qty: Number(item.quantity || 1),
        }))
      ) || [];

    await sendOrderEmail({
      source: "paypal",
      providerId: orderId,
      currency,
      total,
      items,
    });

    res.json({ received: true });
  } catch (error) {
    res.status(500).send("Error webhook PayPal");
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});
