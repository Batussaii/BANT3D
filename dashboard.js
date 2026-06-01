const moneyFmt = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

const state = {
  storageItems: [],
  orders: [],
  expenses: [],
  summary: null,
  pendingOrderItems: [],
};

let resumeChart = null;

const $ = (sel) => document.querySelector(sel);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeOrderItems = (order) => {
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items
      .map((item) => ({
        itemId: item?.itemId || null,
        title: String(item?.title || "").trim(),
        unitPrice: Number(item?.unitPrice) || 0,
        qty: Math.max(1, Math.floor(Number(item?.qty) || 1)),
      }))
      .filter((item) => item.title && item.unitPrice > 0);
  }

  if (order?.itemTitle && Number(order?.unitPrice) > 0) {
    return [
      {
        itemId: order.itemId || null,
        title: String(order.itemTitle),
        unitPrice: Number(order.unitPrice),
        qty: 1,
      },
    ];
  }
  return [];
};

const getOrderTotal = (order) =>
  normalizeOrderItems(order).reduce((sum, item) => sum + item.unitPrice * item.qty, 0);

const renderOrderItemsBlock = (order) => {
  const items = normalizeOrderItems(order);
  if (!items.length) {
    return "<span>-</span>";
  }
  return items
    .map((item) => `<div>${item.qty} ${escapeHtml(item.title)}</div>`)
    .join("");
};

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: { Accept: "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Error de servidor");
  }
  return response.json();
};

const renderStorageSelect = () => {
  const select = $("#orderItemSelect");
  select.innerHTML = '<option value="">Selecciona articulo de Storage</option>';
  state.storageItems.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.title} (${moneyFmt.format(item.price)})`;
    option.dataset.title = item.title;
    option.dataset.price = item.price;
    select.appendChild(option);
  });
};

const renderPendingOrderItems = () => {
  const root = $("#pendingOrderItems");
  if (!state.pendingOrderItems.length) {
    root.innerHTML = "<div style='padding:10px'>Sin articulos añadidos al pedido.</div>";
    return;
  }

  const rows = state.pendingOrderItems
    .map(
      (item, index) => `
      <tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${item.qty}</td>
        <td>${moneyFmt.format(item.unitPrice)}</td>
        <td>${moneyFmt.format(item.unitPrice * item.qty)}</td>
        <td><button class="danger" type="button" data-remove-line="${index}">Quitar</button></td>
      </tr>
    `
    )
    .join("");
  const total = state.pendingOrderItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  root.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Articulo</th>
          <th>Cantidad</th>
          <th>Precio unidad</th>
          <th>Total linea</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <th colspan="3">Total pedido</th>
          <th>${moneyFmt.format(total)}</th>
          <th></th>
        </tr>
      </tfoot>
    </table>
  `;
};

const renderStorage = () => {
  const root = $("#storageList");
  root.innerHTML = "";
  state.storageItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "storage-item";
    card.innerHTML = `
      <img src="${item.imageUrl || ""}" alt="${item.title}" />
      <div class="storage-content">
        <h3>${item.title}</h3>
        <p>${item.description || "-"}</p>
        <strong>${moneyFmt.format(item.price)}</strong>
        <div>
          <button class="danger" data-remove-storage="${item.id}" type="button">Eliminar</button>
        </div>
      </div>
    `;
    root.appendChild(card);
  });
};

const buildOrderChecks = (order) => `
  <label><input type="checkbox" data-status="${order.id}" data-key="done" ${
  order.status?.done ? "checked" : ""
}/> Hecho</label>
  <label><input type="checkbox" data-status="${order.id}" data-key="sent" ${
  order.status?.sent ? "checked" : ""
}/> Enviado</label>
  <label><input type="checkbox" data-status="${order.id}" data-key="paid" ${
  order.status?.paid ? "checked" : ""
}/> Cobrado</label>
`;

const renderOrders = () => {
  const root = $("#ordersList");
  const rows = state.orders
    .map(
      (order) => `
      <tr>
        <td class="items-cell"><div class="items-stack">${renderOrderItemsBlock(order)}</div></td>
        <td>${moneyFmt.format(getOrderTotal(order))}</td>
        <td>${buildOrderChecks(order)}</td>
        <td>${escapeHtml(order.notes || "-")}</td>
        <td><button class="danger" type="button" data-remove-order="${order.id}">Eliminar</button></td>
      </tr>
    `
    )
    .join("");
  root.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Articulo</th>
          <th>Precio</th>
          <th>Estado</th>
          <th>Notas</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

const renderMovements = () => {
  const incomeRoot = $("#incomeRows");
  const expenseRoot = $("#expensesList");
  const paidOrders = state.orders.filter((order) => Boolean(order?.status?.paid));
  const incomeRows = paidOrders
    .map(
      (order) => `
    <tr>
      <td class="items-cell"><div class="items-stack">${renderOrderItemsBlock(order)}</div></td>
      <td>${moneyFmt.format(getOrderTotal(order))}</td>
    </tr>
  `
    )
    .join("");
  incomeRoot.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Importe</th>
        </tr>
      </thead>
      <tbody>${incomeRows}</tbody>
    </table>
  `;

  const expenseRows = state.expenses
    .map(
      (row) => `
    <tr>
      <td>${row.title}</td>
      <td>${moneyFmt.format(row.amount)}</td>
      <td><button class="danger" type="button" data-remove-expense="${row.id}">Eliminar</button></td>
    </tr>
  `
    )
    .join("");
  expenseRoot.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Gasto</th>
          <th>Importe</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${expenseRows}</tbody>
    </table>
  `;
};

const renderSummary = () => {
  const totals = state.summary?.totals || {};
  $("#totalIncome").textContent = moneyFmt.format(totals.income || 0);
  $("#totalExpense").textContent = moneyFmt.format(totals.expense || 0);
  $("#totalBalance").textContent = moneyFmt.format(totals.balance || 0);
  $("#paidOrders").textContent = totals.paidOrders || 0;

  const chartCtx = $("#resumeChart");
  if (resumeChart) {
    resumeChart.destroy();
  }
  resumeChart = new Chart(chartCtx, {
    type: "bar",
    data: {
      labels: ["Ingresos", "Gastos", "Balance"],
      datasets: [
        {
          label: "EUR",
          data: [totals.income || 0, totals.expense || 0, totals.balance || 0],
          backgroundColor: ["#1b9c5a", "#c73e3e", "#314ce0"],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });
};

const renderAll = () => {
  renderStorageSelect();
  renderPendingOrderItems();
  renderStorage();
  renderOrders();
  renderMovements();
  renderSummary();
};

const loadData = async () => {
  const data = await api("/api/dashboard/bootstrap");
  state.storageItems = data.storageItems || [];
  state.orders = data.orders || [];
  state.expenses = data.expenses || [];
  state.summary = data.summary || null;
  renderAll();
};

const saveStorage = async (form) => {
  const fd = new FormData(form);
  await api("/api/dashboard/storage", { method: "POST", body: fd });
  form.reset();
  await loadData();
};

const saveOrder = async (form) => {
  if (!state.pendingOrderItems.length) {
    throw new Error("Añade al menos un articulo al pedido.");
  }
  const body = {
    items: state.pendingOrderItems.map((item) => ({
      itemId: item.itemId || null,
      title: item.title,
      unitPrice: Number(item.unitPrice),
      qty: Number(item.qty),
    })),
    notes: form.notes.value,
    status: {
      done: form.done.checked,
      sent: form.sent.checked,
      paid: form.paid.checked,
    },
  };
  await api("/api/dashboard/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  state.pendingOrderItems = [];
  form.reset();
  form.qty.value = "1";
  renderPendingOrderItems();
  await loadData();
};

const saveExpense = async (form) => {
  const body = {
    title: form.title.value,
    amount: Number(form.amount.value),
  };
  await api("/api/dashboard/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  form.reset();
  await loadData();
};

const wireTabs = () => {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      $("#tab-" + button.dataset.tab).classList.add("active");
    });
  });
};

const wireForms = () => {
  $("#storageForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveStorage(event.currentTarget);
    } catch (error) {
      alert(error.message);
    }
  });

  $("#addOrderLineBtn").addEventListener("click", () => {
    try {
      const select = $("#orderItemSelect");
      const selected = select.options[select.selectedIndex];
      if (!selected || !selected.value) {
        throw new Error("Selecciona un articulo de Storage.");
      }
      const unitPrice = Number($("#orderPrice").value || selected.dataset.price || 0);
      const qty = Math.max(1, Math.floor(Number($("#orderQty").value || 1)));
      if (unitPrice <= 0) {
        throw new Error("El precio de venta debe ser mayor que 0.");
      }
      const existing = state.pendingOrderItems.find(
        (item) =>
          item.itemId === selected.value &&
          Number(item.unitPrice) === Number(unitPrice)
      );
      if (existing) {
        existing.qty += qty;
      } else {
        state.pendingOrderItems.push({
          itemId: selected.value,
          title: selected.dataset.title || selected.textContent,
          unitPrice,
          qty,
        });
      }
      $("#orderQty").value = "1";
      renderPendingOrderItems();
    } catch (error) {
      alert(error.message);
    }
  });

  $("#orderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveOrder(event.currentTarget);
    } catch (error) {
      alert(error.message);
    }
  });

  $("#expenseForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveExpense(event.currentTarget);
    } catch (error) {
      alert(error.message);
    }
  });

  $("#orderItemSelect").addEventListener("change", (event) => {
    const selected = event.currentTarget.options[event.currentTarget.selectedIndex];
    if (!selected || !selected.value) return;
    $("#orderPrice").value = selected.dataset.price || "";
  });
};

const wireListActions = () => {
  document.body.addEventListener("click", async (event) => {
    const storageId = event.target.dataset.removeStorage;
    const orderId = event.target.dataset.removeOrder;
    const expenseId = event.target.dataset.removeExpense;
    const removeLine = event.target.dataset.removeLine;
    try {
      if (removeLine !== undefined) {
        state.pendingOrderItems.splice(Number(removeLine), 1);
        renderPendingOrderItems();
      }
      if (storageId) {
        await api(`/api/dashboard/storage/${storageId}`, { method: "DELETE" });
        await loadData();
      }
      if (orderId) {
        await api(`/api/dashboard/orders/${orderId}`, { method: "DELETE" });
        await loadData();
      }
      if (expenseId) {
        await api(`/api/dashboard/expenses/${expenseId}`, { method: "DELETE" });
        await loadData();
      }
    } catch (error) {
      alert(error.message);
    }
  });

  document.body.addEventListener("change", async (event) => {
    const orderId = event.target.dataset.status;
    const key = event.target.dataset.key;
    if (!orderId || !key) return;
    const order = state.orders.find((row) => row.id === orderId);
    if (!order) return;
    const status = {
      done: key === "done" ? event.target.checked : !!order.status?.done,
      sent: key === "sent" ? event.target.checked : !!order.status?.sent,
      paid: key === "paid" ? event.target.checked : !!order.status?.paid,
    };
    try {
      await api(`/api/dashboard/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadData();
    } catch (error) {
      alert(error.message);
    }
  });
};

const bootstrap = async () => {
  wireTabs();
  wireForms();
  wireListActions();
  $("#refreshBtn").addEventListener("click", () => loadData());
  await loadData();
};

bootstrap().catch((error) => {
  alert(error.message);
});
