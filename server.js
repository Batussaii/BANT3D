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
const dashboardUploadDir = path.join(uploadDir, "dashboard");
if (!fs.existsSync(dashboardUploadDir)) {
  fs.mkdirSync(dashboardUploadDir, { recursive: true });
}
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dashboardDbPath = path.join(dataDir, "dashboard-db.json");
const dashboardAuthUser = process.env.DASHBOARD_USER || "Bant3DAdmin";
const dashboardAuthPass = process.env.DASHBOARD_PASS || "BertyBant3D";

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
});
const dashboardImageUpload = multer({
  storage: multer.diskStorage({
    destination: dashboardUploadDir,
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^\w.-]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
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
const pendingOrders = new Map();

const formatMoney = (value, currency = DEFAULT_CURRENCY) =>
  `${Number(value || 0).toFixed(2)} ${currency}`;

const normalizeCustomer = (customer = {}) => ({
  name: typeof customer?.name === "string" ? customer.name.trim() : "",
  address: typeof customer?.address === "string" ? customer.address.trim() : "",
  phone: typeof customer?.phone === "string" ? customer.phone.trim() : "",
  notes: typeof customer?.notes === "string" ? customer.notes.trim() : "",
  country: typeof customer?.country === "string" ? customer.country.trim() : "",
});

const isCustomerValid = (customer) =>
  Boolean(customer?.name && customer?.address && customer?.phone);

const sendOrderEmail = async ({
  source,
  providerId,
  currency,
  total,
  items,
  customer,
  shipping,
}) => {
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

  const safeCustomer = normalizeCustomer(customer);
  const shippingLabel =
    shipping?.cost === null
      ? "Se cotiza"
      : formatMoney(shipping?.cost || 0, currency);
  const customerText = safeCustomer?.name
    ? `
Cliente:
Nombre: ${safeCustomer.name || "-"}
Direccion: ${safeCustomer.address || "-"}
Movil: ${safeCustomer.phone || "-"}
Pais: ${safeCustomer.country || "-"}
Observaciones: ${safeCustomer.notes || "-"}
Envio: ${shippingLabel}
      `.trim()
    : "";
  const customerHtml = safeCustomer?.name
    ? `
      <h3>Cliente</h3>
      <p><strong>Nombre:</strong> ${safeCustomer.name || "-"}</p>
      <p><strong>Direccion:</strong> ${safeCustomer.address || "-"}</p>
      <p><strong>Movil:</strong> ${safeCustomer.phone || "-"}</p>
      <p><strong>Pais:</strong> ${safeCustomer.country || "-"}</p>
      <p><strong>Observaciones:</strong> ${safeCustomer.notes || "-"}</p>
      <p><strong>Envio:</strong> ${shippingLabel}</p>
    `
    : "";

  await sendMail({
    subject: `Pedido pagado (${source || "pasarela"})`,
    text: `
Metodo: ${source || "-"}
Referencia: ${providerId || "-"}
Moneda: ${currency || DEFAULT_CURRENCY}
Total: ${formatMoney(totalValue, currency)}

${customerText}

Productos:
${orderLines}
    `.trim(),
    html: `
      <h2>Pedido pagado</h2>
      <p><strong>Metodo:</strong> ${source || "-"}</p>
      <p><strong>Referencia:</strong> ${providerId || "-"}</p>
      <p><strong>Moneda:</strong> ${currency || DEFAULT_CURRENCY}</p>
      <p><strong>Total:</strong> ${formatMoney(totalValue, currency)}</p>
      ${customerHtml}
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
      const customer = normalizeCustomer({
        name: session.metadata?.customer_name,
        address: session.metadata?.customer_address,
        phone: session.metadata?.customer_phone,
        notes: session.metadata?.customer_notes,
        country: session.metadata?.customer_country,
      });
      const shipping = {
        cost:
          session.metadata?.shipping_cost &&
          session.metadata.shipping_cost !== "quote"
            ? Number(session.metadata.shipping_cost)
            : null,
        label: session.metadata?.shipping_label || "",
      };
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
        customer,
        shipping,
      });
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).send(`Webhook error: ${error?.message || "Error"}`);
  }
});

app.use(express.json());

const buildDashboardSeed = () => ({
  storageItems: [],
  orders: [],
  expenses: [],
});

const readDashboardDb = () => {
  if (!fs.existsSync(dashboardDbPath)) {
    fs.writeFileSync(dashboardDbPath, JSON.stringify(buildDashboardSeed(), null, 2), "utf8");
  }
  try {
    const raw = fs.readFileSync(dashboardDbPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      storageItems: Array.isArray(parsed?.storageItems) ? parsed.storageItems : [],
      orders: Array.isArray(parsed?.orders) ? parsed.orders : [],
      expenses: Array.isArray(parsed?.expenses) ? parsed.expenses : [],
    };
  } catch (_error) {
    return buildDashboardSeed();
  }
};

const writeDashboardDb = (data) => {
  fs.writeFileSync(dashboardDbPath, JSON.stringify(data, null, 2), "utf8");
};

const buildId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const toMoney = (value) => Number((Number(value) || 0).toFixed(2));

const normalizeOrderItems = (items, fallback = {}) => {
  if (Array.isArray(items) && items.length) {
    return items
      .map((item) => {
        const itemId = typeof item?.itemId === "string" ? item.itemId.trim() : "";
        const title = typeof item?.title === "string" ? item.title.trim() : "";
        const unitPrice = toMoney(item?.unitPrice);
        const qty = Math.max(1, Math.floor(Number(item?.qty) || 0));
        if (!title || unitPrice <= 0) return null;
        return {
          itemId: itemId || null,
          title,
          unitPrice,
          qty,
          lineTotal: toMoney(unitPrice * qty),
        };
      })
      .filter(Boolean);
  }

  const fallbackTitle =
    typeof fallback?.itemTitle === "string" ? fallback.itemTitle.trim() : "";
  const fallbackUnitPrice = toMoney(fallback?.unitPrice);
  if (fallbackTitle && fallbackUnitPrice > 0) {
    return [
      {
        itemId: typeof fallback?.itemId === "string" ? fallback.itemId.trim() || null : null,
        title: fallbackTitle,
        unitPrice: fallbackUnitPrice,
        qty: 1,
        lineTotal: fallbackUnitPrice,
      },
    ];
  }

  return [];
};

const getOrderTotal = (order) => {
  const items = normalizeOrderItems(order?.items, order);
  return toMoney(items.reduce((sum, item) => sum + toMoney(item.lineTotal), 0));
};

const buildOrderTitle = (order) => {
  const items = normalizeOrderItems(order?.items, order);
  if (!items.length) return "Pedido";
  return items.map((item) => `${item.qty} ${item.title}`).join(", ");
};

const dashboardAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Bant3D Dashboard"');
    res.status(401).send("Autorizacion requerida");
    return;
  }
  const encoded = authHeader.split(" ")[1] || "";
  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch (_error) {
    res.status(401).send("Credenciales invalidas");
    return;
  }
  const separator = decoded.indexOf(":");
  if (separator === -1) {
    res.status(401).send("Credenciales invalidas");
    return;
  }
  const user = decoded.slice(0, separator);
  const pass = decoded.slice(separator + 1);
  if (user !== dashboardAuthUser || pass !== dashboardAuthPass) {
    res.set("WWW-Authenticate", 'Basic realm="Bant3D Dashboard"');
    res.status(401).send("Credenciales invalidas");
    return;
  }
  next();
};

const buildDashboardSummary = (data) => {
  const incomeRows = data.orders
    .filter((order) => Boolean(order?.status?.paid))
    .map((order) => ({
      id: order.id,
      title: buildOrderTitle(order),
      amount: getOrderTotal(order),
      createdAt: order.updatedAt || order.createdAt,
    }));
  const totalIncome = incomeRows.reduce((sum, row) => sum + row.amount, 0);
  const totalExpense = data.expenses.reduce((sum, row) => sum + toMoney(row.amount), 0);
  return {
    totals: {
      income: toMoney(totalIncome),
      expense: toMoney(totalExpense),
      balance: toMoney(totalIncome - totalExpense),
      paidOrders: incomeRows.length,
      pendingOrders: data.orders.filter((order) => !order?.status?.paid).length,
    },
    incomeRows,
    expenses: data.expenses,
  };
};

app.get("/BANTDASHBOARD", dashboardAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/api/dashboard/bootstrap", dashboardAuth, (_req, res) => {
  const data = readDashboardDb();
  const summary = buildDashboardSummary(data);
  res.json({
    storageItems: data.storageItems,
    orders: data.orders,
    expenses: data.expenses,
    summary,
  });
});

app.get("/api/dashboard/summary", dashboardAuth, (_req, res) => {
  const data = readDashboardDb();
  res.json(buildDashboardSummary(data));
});

app.post("/api/dashboard/storage", dashboardAuth, dashboardImageUpload.single("image"), (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description =
    typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const price = toMoney(req.body?.price);
  if (!title || price <= 0) {
    res.status(400).json({ error: "Titulo y precio validos son obligatorios." });
    return;
  }

  const data = readDashboardDb();
  const item = {
    id: buildId("item"),
    title,
    description,
    price,
    imageUrl: req.file ? `/uploads/dashboard/${req.file.filename}` : "",
    createdAt: new Date().toISOString(),
  };
  data.storageItems.unshift(item);
  writeDashboardDb(data);
  res.status(201).json(item);
});

app.patch("/api/dashboard/storage/:id", dashboardAuth, dashboardImageUpload.single("image"), (req, res) => {
  const data = readDashboardDb();
  const item = data.storageItems.find((row) => row.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Articulo no encontrado." });
    return;
  }
  const maybeTitle = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const maybeDescription =
    typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const maybePrice = req.body?.price !== undefined ? toMoney(req.body.price) : null;
  if (maybeTitle) item.title = maybeTitle;
  if (req.body?.description !== undefined) item.description = maybeDescription;
  if (maybePrice !== null && maybePrice > 0) item.price = maybePrice;
  if (req.file) {
    item.imageUrl = `/uploads/dashboard/${req.file.filename}`;
  }
  item.updatedAt = new Date().toISOString();
  writeDashboardDb(data);
  res.json(item);
});

app.delete("/api/dashboard/storage/:id", dashboardAuth, (req, res) => {
  const data = readDashboardDb();
  const before = data.storageItems.length;
  data.storageItems = data.storageItems.filter((row) => row.id !== req.params.id);
  if (before === data.storageItems.length) {
    res.status(404).json({ error: "Articulo no encontrado." });
    return;
  }
  writeDashboardDb(data);
  res.json({ ok: true });
});

app.post("/api/dashboard/orders", dashboardAuth, (req, res) => {
  const items = normalizeOrderItems(req.body?.items, req.body || {});
  if (!items.length) {
    res.status(400).json({ error: "Debes añadir al menos un articulo valido al pedido." });
    return;
  }
  const data = readDashboardDb();
  const total = toMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const order = {
    id: buildId("order"),
    items,
    itemId: items[0]?.itemId || null,
    itemTitle: buildOrderTitle({ items }),
    unitPrice: total,
    total,
    status: {
      done: Boolean(req.body?.status?.done),
      sent: Boolean(req.body?.status?.sent),
      paid: Boolean(req.body?.status?.paid),
    },
    notes: typeof req.body?.notes === "string" ? req.body.notes.trim() : "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.orders.unshift(order);
  writeDashboardDb(data);
  res.status(201).json(order);
});

app.patch("/api/dashboard/orders/:id", dashboardAuth, (req, res) => {
  const data = readDashboardDb();
  const order = data.orders.find((row) => row.id === req.params.id);
  if (!order) {
    res.status(404).json({ error: "Pedido no encontrado." });
    return;
  }
  if (typeof req.body?.itemTitle === "string" && req.body.itemTitle.trim()) {
    order.itemTitle = req.body.itemTitle.trim();
  }
  if (req.body?.unitPrice !== undefined) {
    const maybeUnitPrice = toMoney(req.body.unitPrice);
    if (maybeUnitPrice > 0) {
      order.unitPrice = maybeUnitPrice;
    }
  }
  if (Array.isArray(req.body?.items)) {
    const normalizedItems = normalizeOrderItems(req.body.items, order);
    if (normalizedItems.length) {
      order.items = normalizedItems;
      const total = toMoney(normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0));
      order.total = total;
      order.unitPrice = total;
      order.itemId = normalizedItems[0]?.itemId || null;
      order.itemTitle = buildOrderTitle({ items: normalizedItems });
    }
  }
  if (req.body?.status && typeof req.body.status === "object") {
    order.status = {
      done: Boolean(req.body.status.done),
      sent: Boolean(req.body.status.sent),
      paid: Boolean(req.body.status.paid),
    };
  }
  if (req.body?.notes !== undefined) {
    order.notes = typeof req.body.notes === "string" ? req.body.notes.trim() : "";
  }
  order.updatedAt = new Date().toISOString();
  writeDashboardDb(data);
  res.json(order);
});

app.delete("/api/dashboard/orders/:id", dashboardAuth, (req, res) => {
  const data = readDashboardDb();
  const before = data.orders.length;
  data.orders = data.orders.filter((row) => row.id !== req.params.id);
  if (before === data.orders.length) {
    res.status(404).json({ error: "Pedido no encontrado." });
    return;
  }
  writeDashboardDb(data);
  res.json({ ok: true });
});

app.post("/api/dashboard/expenses", dashboardAuth, (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const amount = toMoney(req.body?.amount);
  if (!title || amount <= 0) {
    res.status(400).json({ error: "Titulo y precio validos son obligatorios." });
    return;
  }
  const data = readDashboardDb();
  const expense = {
    id: buildId("expense"),
    title,
    amount,
    createdAt: new Date().toISOString(),
  };
  data.expenses.unshift(expense);
  writeDashboardDb(data);
  res.status(201).json(expense);
});

app.delete("/api/dashboard/expenses/:id", dashboardAuth, (req, res) => {
  const data = readDashboardDb();
  const before = data.expenses.length;
  data.expenses = data.expenses.filter((row) => row.id !== req.params.id);
  if (before === data.expenses.length) {
    res.status(404).json({ error: "Gasto no encontrado." });
    return;
  }
  writeDashboardDb(data);
  res.json({ ok: true });
});

const sendMail = async ({ to, subject, text, html, attachments }) => {
  const transporter = buildTransporter();
  if (!transporter) {
    throw new Error("SMTP no configurado");
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: to || getRecipient(),
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

app.post("/api/arirang-participation", async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const createdAt =
      typeof req.body?.createdAt === "string" ? req.body.createdAt : new Date().toISOString();
    const songsOrder = Array.isArray(req.body?.songsOrder) ? req.body.songsOrder : [];

    if (!name || !email) {
      res.status(400).json({ error: "Nombre y email son obligatorios." });
      return;
    }

    if (!songsOrder.length) {
      res.status(400).json({ error: "Debes enviar el orden de canciones." });
      return;
    }

    const normalizedSongs = songsOrder
      .map((song, index) => ({
        position: Number(song?.position) || index + 1,
        title: typeof song?.title === "string" ? song.title.trim() : "",
      }))
      .filter((song) => song.title);

    if (!normalizedSongs.length) {
      res.status(400).json({ error: "El orden de canciones no es valido." });
      return;
    }

    const songsText = normalizedSongs
      .map((song) => `${song.position}. ${song.title}`)
      .join("\n");

    await sendMail({
      subject: `Nueva porra ARIRANG - ${name}`,
      text: `
Nueva participacion en Porra ARIRANG ARMY Cadiz

Nombre: ${name}
Email: ${email}
Fecha: ${createdAt}

Orden de canciones:
${songsText}
      `.trim(),
      html: `
        <h2>Nueva participacion en Porra ARIRANG ARMY Cadiz</h2>
        <p><strong>Nombre:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Fecha:</strong> ${createdAt}</p>
        <h3>Orden de canciones</h3>
        <ol>
          ${normalizedSongs.map((song) => `<li>${song.title}</li>`).join("")}
        </ol>
      `,
      attachments: [],
    });

    await sendMail({
      to: email,
      subject: "Hemos recibido tu porra ARIRANG",
      text: `
Hola ${name},

Gracias por participar en la Porra ARIRANG ARMY Cadiz.
Hemos recibido correctamente tu orden de canciones:

${songsText}

Nos vemos en el evento.
      `.trim(),
      html: `
        <h2>Hemos recibido tu porra ARIRANG</h2>
        <p>Hola <strong>${name}</strong>,</p>
        <p>Gracias por participar en la Porra ARIRANG ARMY Cadiz.</p>
        <p>Este es el orden de canciones que registramos:</p>
        <ol>
          ${normalizedSongs.map((song) => `<li>${song.title}</li>`).join("")}
        </ol>
        <p>Nos vemos en el evento.</p>
      `,
      attachments: [],
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({
      error: error?.message || "No se pudo registrar la participacion.",
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
    const customer = normalizeCustomer(req.body?.customer);
    const shipping = req.body?.shipping || {};
    if (!items.length) {
      res.status(400).json({ error: "No hay productos para cobrar." });
      return;
    }
    if (!isCustomerValid(customer)) {
      res.status(400).json({ error: "Datos de envio incompletos." });
      return;
    }

    const currency = (req.body?.currency || DEFAULT_CURRENCY).toLowerCase();
    const baseUrl = getBaseUrl(req);
    const successUrl = req.body?.successUrl || `${baseUrl}/tienda.html?payment=success`;
    const cancelUrl = req.body?.cancelUrl || `${baseUrl}/tienda.html?payment=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      metadata: {
        customer_name: customer.name,
        customer_address: customer.address,
        customer_phone: customer.phone,
        customer_notes: customer.notes || "",
        customer_country: customer.country || "",
        shipping_cost:
          typeof shipping?.cost === "number" ? shipping.cost.toString() : "quote",
        shipping_label: typeof shipping?.label === "string" ? shipping.label : "",
      },
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
    const customer = normalizeCustomer(req.body?.customer);
    const shipping = req.body?.shipping || {};
    if (!items.length) {
      res.status(400).json({ error: "No hay productos para cobrar." });
      return;
    }
    if (!isCustomerValid(customer)) {
      res.status(400).json({ error: "Datos de envio incompletos." });
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

    const orderId = response?.result?.id;
    if (orderId) {
      pendingOrders.set(orderId, { customer, shipping });
    }

    res.json({ url: approve.href, orderId });
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
    const pending = pendingOrders.get(orderId);
    if (pending) {
      pendingOrders.delete(orderId);
    }

    await sendOrderEmail({
      source: "paypal",
      providerId: orderId,
      currency,
      total,
      items,
      customer: pending?.customer,
      shipping: pending?.shipping,
    });

    res.json({ received: true });
  } catch (error) {
    res.status(500).send("Error webhook PayPal");
  }
});

app.get("/arirang", (req, res) => {
  res.sendFile(path.join(__dirname, "arirang.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});
