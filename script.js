const form = document.getElementById("customRequestForm");
const formNote = document.getElementById("formNote");
const slider = document.querySelector(".products-bg-slider");
const storeProducts = document.getElementById("storeProducts");
const storeCategories = document.getElementById("storeCategories");
const storeSearch = document.getElementById("storeSearch");
const storePrice = document.getElementById("storePrice");
const cartList = document.getElementById("cartList");
const cartTotal = document.getElementById("cartTotal");
const cartSubtotal = document.getElementById("cartSubtotal");
const cartDiscount = document.getElementById("cartDiscount");
const cartDiscountRow = document.getElementById("cartDiscountRow");
const cartShipping = document.getElementById("cartShipping");
const cartShippingNote = document.getElementById("cartShippingNote");
const couponInput = document.getElementById("couponInput");
const couponApply = document.getElementById("couponApply");
const couponStatus = document.getElementById("couponStatus");
const paymentAlert = document.getElementById("paymentAlert");
const checkoutButton = document.getElementById("checkoutButton");
const checkoutModal = document.getElementById("checkoutModal");
const checkoutModalClose = document.getElementById("checkoutModalClose");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutName = document.getElementById("checkoutName");
const checkoutAddress = document.getElementById("checkoutAddress");
const checkoutPhone = document.getElementById("checkoutPhone");
const checkoutNotes = document.getElementById("checkoutNotes");
const checkoutCountry = document.getElementById("checkoutCountry");
const checkoutShipping = document.getElementById("checkoutShipping");
const internationalNote = document.getElementById("internationalNote");
const checkoutItemsCount = document.getElementById("checkoutItemsCount");
const checkoutTotal = document.getElementById("checkoutTotal");
const checkoutNote = document.getElementById("checkoutNote");
const payWithCard = document.getElementById("payWithCard");
const payWithPaypal = document.getElementById("payWithPaypal");
const colorModal = document.getElementById("colorRequestModal");
const colorModalForm = document.getElementById("colorRequestForm");
const colorModalClose = document.getElementById("colorModalClose");
const colorModalProduct = document.getElementById("colorModalProduct");
const colorModalProductInput = document.getElementById("colorModalProductInput");
const colorModalNote = document.getElementById("colorModalNote");
const colorModalPreview = document.getElementById("colorModalPreview");
const imageModal = document.getElementById("imagePreviewModal");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalClose = document.getElementById("imageModalClose");
const imageModalPrev = document.getElementById("imageModalPrev");
const imageModalNext = document.getElementById("imageModalNext");
const imageModalCounter = document.getElementById("imageModalCounter");
const AVAILABLE_COLORS = [
  "#ffffff",
  "#111827",
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f5f5dc",
  "#ffff26",
];
const REQUEST_ENDPOINT = "/api/request";
const COLOR_ENDPOINT = "/api/color-request";
const STRIPE_ENDPOINT = "/api/checkout/stripe";
const PAYPAL_ENDPOINT = "/api/checkout/paypal";
const COLOR_NAME_MAP = {
  blanco: "#ffffff",
  negro: "#000000",
  rojo: "#ef4444",
  azul: "#3b82f6",
  verde: "#22c55e",
  amarillo: "#facc15",
  naranja: "#f97316",
  morado: "#8b5cf6",
  rosa: "#f9a8d4",
  gris: "#9ca3af",
  beige: "#f5f5dc",
};
const sliderDirectory = "assets/SliderIndex/";
const fallbackImages = [
  "assets/SliderIndex/test1.png",
  "assets/SliderIndex/test2.png",
  "assets/SliderIndex/test3.png",
  "assets/SliderIndex/test4.png",
  "assets/SliderIndex/test5.png",
];

const HERO_PROMO_CONFIG = {
  isProductPromo: true,
  badge: "NEW",
  product: {
    kicker: "Promocion de producto",
    title: "Soporte auriculares Sakura",
    description: "Edicion limitada con acabado premium.",
    imageSrc: "assets/StoreImages/Soporte-auriculares-Sakura.png",
    imageAlt: "Soporte auriculares Sakura",
    price: 15,
    oldPriceAdd: 5,
  },
  web: {
    kicker: "Promocion web",
    title: "20% en tu primer pedido",
    description: "Usa el codigo y activa el descuento al pagar.",
    code: "BANT20",
  },
};

const SLIDE_INTERVAL_MS = 7000;
let sliderTimer = null;

const FREE_SHIPPING_THRESHOLD = 30;
const INTERNATIONAL_MIN_ORDER = 50;

const formatCurrency = (value) => `€${value.toFixed(2)}`;

const calculateShipping = (subtotal, country) => {
  if (country && country !== "ES") {
    return { cost: null, label: "Se cotiza" };
  }
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return { cost: 0, label: "Gratis" };
  }
  if (subtotal >= 10) {
    return { cost: 2.95, label: "2,95€" };
  }
  return { cost: 4.95, label: "4,95€" };
};

const showPaymentAlert = (type, message) => {
  if (!paymentAlert) return;
  if (!message) {
    paymentAlert.textContent = "";
    paymentAlert.className = "alert";
    return;
  }
  paymentAlert.textContent = message;
  paymentAlert.className = `alert alert-${type}`;
};

const startSlider = () => {
  if (!slider) return;
  const slides = Array.from(slider.querySelectorAll("img"));
  if (!slides.length) return;

  let activeIndex = 0;
  slides.forEach((img, index) => {
    img.classList.toggle("is-active", index === activeIndex);
  });

  if (sliderTimer) {
    clearInterval(sliderTimer);
  }

  sliderTimer = setInterval(() => {
    slides[activeIndex].classList.remove("is-active");
    activeIndex = (activeIndex + 1) % slides.length;
    slides[activeIndex].classList.add("is-active");
  }, SLIDE_INTERVAL_MS);
};

const loadSliderImages = async () => {
  if (!slider) return;

  let images = [];
  const datasetImages = slider.dataset.images;
  if (datasetImages) {
    images = datasetImages
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (!images.length) {
    try {
      const response = await fetch(sliderDirectory);
      if (response.ok) {
        const text = await response.text();
        const regex = /href="([^"]+\.(?:png|jpe?g|webp|gif))"/gi;
        const matches = new Set();
        let match = regex.exec(text);
        while (match) {
          matches.add(match[1]);
          match = regex.exec(text);
        }
        images = Array.from(matches).map((path) => {
          if (path.startsWith("http")) return path;
          if (path.startsWith(sliderDirectory)) return path;
          return `${sliderDirectory}${path.replace(/^\.?\//, "")}`;
        });
      }
    } catch (error) {
      images = [];
    }
  }

  if (!images.length) {
    images = fallbackImages;
  }

  slider.innerHTML = "";
  images.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.decoding = "async";
    img.loading = "lazy";
    slider.appendChild(img);
  });

  startSlider();
};

const formatPromoPrice = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded}€`;
  return `${rounded.toFixed(2).replace(".", ",")}€`;
};

const initHeroPromo = () => {
  const promo = document.querySelector("[data-hero-promo]");
  if (!promo) return;
  const badge = promo.querySelector("[data-hero-promo-badge]");
  const kicker = promo.querySelector("[data-hero-promo-kicker]");
  const title = promo.querySelector("[data-hero-promo-title]");
  const desc = promo.querySelector("[data-hero-promo-desc]");
  const code = promo.querySelector("[data-hero-promo-code]");
  const image = promo.querySelector("[data-hero-promo-image]");
  const price = promo.querySelector("[data-hero-promo-price]");
  const oldPrice = promo.querySelector("[data-hero-promo-price-old]");
  const newPrice = promo.querySelector("[data-hero-promo-price-new]");

  const setText = (element, value) => {
    if (!element) return;
    element.textContent = value || "";
  };

  const setHidden = (element, isHidden) => {
    if (!element) return;
    element.classList.toggle("is-hidden", isHidden);
  };

  const { isProductPromo, badge: badgeLabel, product, web } = HERO_PROMO_CONFIG;

  promo.classList.toggle("is-product", isProductPromo);
  promo.classList.toggle("is-web", !isProductPromo);

  setText(badge, badgeLabel);

  if (isProductPromo) {
    setText(kicker, product.kicker);
    setText(title, product.title);
    setText(desc, product.description);
    const basePrice = typeof product.price === "number" ? product.price : Number(product.price);
    const extra = typeof product.oldPriceAdd === "number" ? product.oldPriceAdd : 0;
    const oldValue = basePrice + extra;
    setText(oldPrice, formatPromoPrice(oldValue));
    setText(newPrice, formatPromoPrice(basePrice));
    setHidden(code, true);
    setHidden(price, false);

    if (image instanceof HTMLImageElement) {
      image.src = product.imageSrc;
      image.alt = product.imageAlt || product.title || "Producto en promocion";
      image.loading = "lazy";
      image.decoding = "async";
    }
  } else {
    setText(kicker, web.kicker);
    setText(title, web.title);
    setText(desc, web.description);
    setText(code, web.code);
    setHidden(code, !web.code);
    setHidden(price, true);

    if (image instanceof HTMLImageElement) {
      image.removeAttribute("src");
      image.alt = "";
    }
  }
};

const sendFormToApi = async (formElement, noteElement, successMessage) => {
  try {
    const fileInput = formElement.querySelector('input[type="file"]');
    if (fileInput instanceof HTMLInputElement && fileInput.files?.length) {
      const file = fileInput.files[0];
      if (file.size > 10 * 1024 * 1024) {
        if (noteElement) {
          noteElement.textContent = "La imagen supera el tamaño máximo de 10MB.";
        }
        return false;
      }
    }

    const response = await fetch(formElement.dataset.endpoint || REQUEST_ENDPOINT, {
      method: "POST",
      body: new FormData(formElement),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message =
        data?.error || "No se pudo enviar. Intenta nuevamente en unos minutos.";
      if (noteElement) {
        noteElement.textContent = message;
      }
      return false;
    }

    if (noteElement) {
      noteElement.textContent = successMessage;
    }
    formElement.reset();
    return true;
  } catch (error) {
    if (noteElement) {
      const message =
        typeof error?.message === "string" && error.message.length
          ? `No se pudo enviar: ${error.message}`
          : "No se pudo enviar. Revisa tu conexión e intenta nuevamente.";
      noteElement.textContent = message;
    }
    return false;
  }
};

if (form) {
  form.dataset.endpoint = REQUEST_ENDPOINT;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendFormToApi(
      form,
      formNote,
      "¡Gracias! Tu solicitud fue enviada. Te responderemos muy pronto."
    );
  });
}

initHeroPromo();
loadSliderImages();

if (storeProducts) {
  const products = Array.from(storeProducts.querySelectorAll("[data-product]"));
  const cart = [];
  let activeCategory = "all";
  const ACTIVE_COUPON = { code: "BANT20", percent: 0.2 };
  let appliedCoupon = null;

  const normalizeCoupon = (value) => value.trim().toUpperCase();

  const getDiscount = (subtotal) => {
    if (!appliedCoupon) return 0;
    return subtotal * appliedCoupon.percent;
  };

  const updateCheckoutSummary = () => {
    if (!checkoutItemsCount || !checkoutTotal) return;
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discount = getDiscount(subtotal);
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const country = checkoutCountry?.value || "ES";
    const shipping = calculateShipping(subtotal, country);
    const total =
      shipping.cost === null ? discountedSubtotal : discountedSubtotal + shipping.cost;
    checkoutItemsCount.textContent = itemCount.toString();
    checkoutTotal.textContent = formatCurrency(total);
    if (checkoutShipping) {
      checkoutShipping.textContent =
        shipping.cost === null ? shipping.label : formatCurrency(shipping.cost);
    }
  };

  const renderCart = () => {
    if (!cartList || !cartTotal) return;
    cartList.innerHTML = "";

    if (!cart.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No hay productos todavía.";
      cartList.appendChild(empty);
      if (cartSubtotal) cartSubtotal.textContent = "€0.00";
      if (cartDiscount) cartDiscount.textContent = "€0.00";
      if (cartDiscountRow) cartDiscountRow.classList.add("is-hidden");
      if (cartShipping) cartShipping.textContent = "€0.00";
      cartTotal.textContent = "€0.00";
      return;
    }

    let subtotal = 0;
    cart.forEach((item) => {
      subtotal += item.price * item.qty;
      const row = document.createElement("div");
      row.className = "cart-item";
      const colorLine = item.colors?.length
        ? `<div class="cart-color-row">
             ${item.colors
               .map((color) => `<span class="cart-color-dot" style="background:${color}"></span>`)
               .join("")}
           </div>`
        : "";
      const optionLine = item.variant
        ? `<div class="muted">Opcion: ${item.variant}</div>`
        : "";
      row.innerHTML = `
        <div>
          <strong>${item.name}</strong>
          <div class="muted">x${item.qty}</div>
          ${optionLine}
          ${colorLine}
        </div>
        <button type="button" data-remove="${item.key}">Quitar</button>
      `;
      cartList.appendChild(row);
    });

    const discount = getDiscount(subtotal);
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const country = checkoutCountry?.value || "ES";
    const shipping = calculateShipping(subtotal, country);
    const total =
      shipping.cost === null ? discountedSubtotal : discountedSubtotal + shipping.cost;
    if (cartSubtotal) cartSubtotal.textContent = formatCurrency(subtotal);
    if (cartDiscount) {
      cartDiscount.textContent =
        discount > 0 ? `-${formatCurrency(discount)}` : "€0.00";
    }
    if (cartDiscountRow) {
      cartDiscountRow.classList.toggle("is-hidden", discount <= 0);
    }
    if (cartShipping) {
      cartShipping.textContent =
        shipping.cost === null ? shipping.label : formatCurrency(shipping.cost);
    }
    cartTotal.textContent = formatCurrency(total);
    if (checkoutButton instanceof HTMLButtonElement) {
      checkoutButton.disabled = !cart.length;
      checkoutButton.classList.toggle("is-disabled", !cart.length);
    }
    if (cartShippingNote) {
      if (country !== "ES") {
        cartShippingNote.textContent =
          subtotal >= INTERNATIONAL_MIN_ORDER
            ? "Envío internacional se cotiza. Producción bajo pedido (5-7 días)."
            : `Solo pedidos internacionales desde ${formatCurrency(
                INTERNATIONAL_MIN_ORDER
              )}.`;
      } else if (subtotal >= FREE_SHIPPING_THRESHOLD) {
        cartShippingNote.textContent = "¡Tienes envío gratis!";
      } else {
        const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
        cartShippingNote.textContent = `Te faltan ${formatCurrency(
          remaining
        )} para envío gratis.`;
      }
    }
    updateCheckoutSummary();
  };

  const applyCoupon = () => {
    if (!couponInput) return;
    const code = normalizeCoupon(couponInput.value || "");
    if (!code) {
      appliedCoupon = null;
      if (couponStatus) couponStatus.textContent = "";
      renderCart();
      return;
    }
    if (code === ACTIVE_COUPON.code) {
      appliedCoupon = ACTIVE_COUPON;
      if (couponStatus) {
        couponStatus.textContent = `Codigo aplicado: ${ACTIVE_COUPON.code} (-20%)`;
      }
    } else {
      appliedCoupon = null;
      if (couponStatus) {
        couponStatus.textContent = "Codigo no valido.";
      }
    }
    renderCart();
  };

  const setProductImages = () => {
    products.forEach((card) => {
      const id = card.dataset.id;
      const name = card.dataset.name || "Producto";
      const image = card.querySelector("[data-store-image]");
      if (!id || !(image instanceof HTMLImageElement)) return;
      image.src = `assets/StoreImages/${id}.png`;
      image.alt = name;
      image.addEventListener("load", () => {
        image.parentElement?.classList.add("has-image");
      });
      image.addEventListener("error", () => {
        image.parentElement?.classList.remove("has-image");
      });
    });
  };

  const loadGalleryImages = async (id) => {
    const images = [];
    const maxImages = 10;
    for (let i = 1; i <= maxImages; i += 1) {
      const src = `assets/StoreImages/${id}-${i}.png`;
      const exists = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
      });
      if (!exists) break;
      images.push(src);
    }
    if (!images.length) {
      images.push(`assets/StoreImages/${id}.png`);
    }
    return images;
  };

  const normalizeColorValue = (value) => {
    if (!value) return "";
    const trimmed = value.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    const mapped = COLOR_NAME_MAP[trimmed.toLowerCase()];
    return mapped || "";
  };

  const buildDefaultColors = (card, count) => {
    const max = Math.max(1, Math.min(4, count));
    const colors = [];
    for (let i = 1; i <= max; i += 1) {
      const rawValue = card.dataset[`color${i}`] || "";
      const normalized = normalizeColorValue(rawValue);
      colors.push(normalized || AVAILABLE_COLORS[(i - 1) % AVAILABLE_COLORS.length]);
    }
    return colors;
  };

  const addToCart = (product) => {
    const existing = cart.find((item) => item.key === product.key);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ ...product, qty: 1 });
    }
    renderCart();
  };

  const renderDropdownOptions = (card) => {
    const isDropdown = card.dataset.desplegable === "true";
    if (!isDropdown) return;

    const info = card.querySelector(".store-info");
    const addButton = card.querySelector(".add-to-cart");
    if (!info || !(addButton instanceof HTMLButtonElement)) return;

    const rawOptions = card.dataset.contentDesplegable || "";
    const options = rawOptions
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!options.length) return;

    const wrapper = document.createElement("label");
    wrapper.className = "option-select";
    wrapper.innerHTML = `
      Elige modelo
      <select class="option-picker" aria-label="Selecciona una opcion">
        <option value="">Selecciona una opcion</option>
      </select>
    `;

    const select = wrapper.querySelector("select");
    if (!(select instanceof HTMLSelectElement)) return;

    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option;
      select.appendChild(opt);
    });

    addButton.disabled = true;
    addButton.classList.add("is-disabled");

    select.addEventListener("change", () => {
      const value = select.value;
      card.dataset.selectedVariant = value;
      const canEnable = Boolean(value);
      addButton.disabled = !canEnable;
      addButton.classList.toggle("is-disabled", !canEnable);
    });

    info.insertBefore(wrapper, addButton);
  };

  const renderColorOptions = (card) => {
    const isCustom = card.dataset.custom === "true";
    if (!isCustom) return;

    const info = card.querySelector(".store-info");
    const addButton = card.querySelector(".add-to-cart");
    if (!info || !(addButton instanceof HTMLButtonElement)) return;

    const count = Number(card.dataset.colorCount || 1);
    const maxSelections = Math.max(1, Math.min(4, count));
    const defaults = buildDefaultColors(card, maxSelections);
    const selectedColors = defaults.filter(Boolean).slice(0, maxSelections);
    card.dataset.selectedColors = JSON.stringify(selectedColors);

    const wrapper = document.createElement("label");
    wrapper.className = "color-select";
    wrapper.innerHTML = `
      Color disponible
      <div class="color-swatches" role="listbox" aria-label="Selecciona colores"></div>
      <span class="color-count">Selecciona ${maxSelections}</span>
      <div class="color-selection" aria-hidden="true"></div>
      <p class="color-help">
        Mas Colores a
        <button type="button" class="color-link" data-open-color-modal>
          CONSULTAR
        </button>
      </p>
    `;

    const swatchContainer = wrapper.querySelector(".color-swatches");
    const selectionContainer = wrapper.querySelector(".color-selection");
    if (!(swatchContainer instanceof HTMLElement) || !(selectionContainer instanceof HTMLElement)) {
      return;
    }

    const updateButtonState = () => {
      const selected = JSON.parse(card.dataset.selectedColors || "[]");
      const ready = selected.length === maxSelections && selected.every(Boolean);
      addButton.disabled = !ready;
      addButton.classList.toggle("is-disabled", !ready);
    };

    const renderSelectionDots = () => {
      const selected = JSON.parse(card.dataset.selectedColors || "[]");
      selectionContainer.innerHTML = "";
      selected.slice(0, maxSelections).forEach((color, index) => {
        const dot = document.createElement("span");
        dot.className = "color-dot";
        dot.style.background = color || "transparent";
        dot.dataset.index = index.toString();
        selectionContainer.appendChild(dot);
      });
    };

    AVAILABLE_COLORS.forEach((hex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-swatch";
      button.style.background = hex;
      button.setAttribute("role", "option");
      button.setAttribute("aria-label", `Color ${hex.toUpperCase()}`);
      button.dataset.color = hex;
      if (selectedColors.includes(hex)) {
        button.classList.add("is-selected");
      }
      swatchContainer.appendChild(button);
    });

    renderSelectionDots();
    updateButtonState();

    swatchContainer.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const value = target.dataset.color;
      if (!value) return;

      const current = JSON.parse(card.dataset.selectedColors || "[]");
      let index = Number(card.dataset.selectedIndex || 0);
      if (Number.isNaN(index)) index = 0;
      const nextIndex = index % maxSelections;
      current[nextIndex] = value;
      card.dataset.selectedColors = JSON.stringify(current);
      card.dataset.selectedIndex = ((nextIndex + 1) % maxSelections).toString();

      swatchContainer.querySelectorAll(".color-swatch").forEach((swatch) => {
        const swatchColor = swatch.dataset.color;
        swatch.classList.toggle(
          "is-selected",
          swatchColor ? current.includes(swatchColor) : false
        );
      });
      renderSelectionDots();
      updateButtonState();
    });

    wrapper.querySelector("[data-open-color-modal]")?.addEventListener("click", () => {
      if (!colorModal) return;
      const name = card.dataset.name || "Producto";
      colorModalProduct.textContent = name;
      if (colorModalProductInput) {
        colorModalProductInput.value = name;
      }
      colorModal.dataset.productId = card.dataset.id || "";
      colorModal.classList.add("is-visible");
      document.body.classList.add("modal-open");
    });

    info.insertBefore(wrapper, addButton);
  };

  const removeFromCart = (key) => {
    const index = cart.findIndex((item) => item.key === key);
    if (index === -1) return;
    if (cart[index].qty > 1) {
      cart[index].qty -= 1;
    } else {
      cart.splice(index, 1);
    }
    renderCart();
  };

  const matchesPrice = (price, range) => {
    if (range === "all") return true;
    if (range === "100+") return price >= 100;
    const [min, max] = range.split("-").map((value) => Number(value));
    return price >= min && price <= max;
  };

  const applyFilters = () => {
    const query = storeSearch ? storeSearch.value.toLowerCase().trim() : "";
    const priceRange = storePrice ? storePrice.value : "all";

    products.forEach((card) => {
      const name = card.dataset.name?.toLowerCase() || "";
      const category = card.dataset.category || "";
      const price = Number(card.dataset.price || 0);
      const matchesCategory = activeCategory === "all" || category === activeCategory;
      const matchesQuery = !query || name.includes(query);
      const matchesRange = matchesPrice(price, priceRange);

      card.classList.toggle(
        "is-hidden",
        !(matchesCategory && matchesQuery && matchesRange)
      );
    });
  };

  storeProducts.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (imageModal && (target.closest(".store-image") || target.classList.contains("store-thumb"))) {
      const card = target.closest("[data-product]");
      if (!card || !imageModalImg) return;
      const id = card.dataset.id;
      if (!id) return;
      loadGalleryImages(id).then((images) => {
        imageModal.dataset.images = JSON.stringify(images);
        imageModal.dataset.index = "0";
        imageModalImg.src = images[0];
        if (imageModalCounter) {
          imageModalCounter.textContent = `1/${images.length}`;
        }
        if (imageModalPrev) imageModalPrev.disabled = images.length <= 1;
        if (imageModalNext) imageModalNext.disabled = images.length <= 1;
        imageModal.classList.add("is-visible");
        document.body.classList.add("modal-open");
      });
      return;
    }
    if (target.classList.contains("add-to-cart")) {
      const card = target.closest("[data-product]");
      if (!card) return;
      const selectedColors = JSON.parse(card.dataset.selectedColors || "[]");
      if (card.dataset.custom === "true" && selectedColors.some((color) => !color)) {
        return;
      }
      const selectedVariant = card.dataset.selectedVariant || "";
      if (card.dataset.desplegable === "true" && !selectedVariant) {
        return;
      }
      const key = `${card.dataset.id || ""}::${selectedVariant}::${selectedColors.join("|")}`;
      addToCart({
        key,
        id: card.dataset.id || "",
        name: card.dataset.name || "Producto",
        price: Number(card.dataset.price || 0),
        colors: selectedColors,
        variant: selectedVariant,
      });
    }
  });

  cartList?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.dataset.remove;
    if (id) {
      removeFromCart(id);
    }
  });

  couponApply?.addEventListener("click", applyCoupon);
  couponInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyCoupon();
  });

  storeCategories?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const category = target.dataset.category;
    if (!category) return;
    activeCategory = category;
    storeCategories.querySelectorAll(".tag").forEach((tag) => {
      tag.classList.toggle("is-active", tag === target);
    });
    applyFilters();
  });

  storeSearch?.addEventListener("input", applyFilters);
  storePrice?.addEventListener("change", applyFilters);

  products.forEach(renderDropdownOptions);
  products.forEach(renderColorOptions);
  applyFilters();
  renderCart();
  setProductImages();
  if (checkoutCountry && internationalNote) {
    internationalNote.classList.toggle("is-visible", checkoutCountry.value !== "ES");
  }
  products.forEach((card) => {
    const info = card.querySelector(".store-info");
    if (!info) return;
    if (info.querySelector(".shipping-tag")) return;
    const tag = document.createElement("p");
    tag.className = "shipping-tag";
    tag.textContent = "Envío gratis desde 30€";
    info.appendChild(tag);
  });
  if (checkoutButton && checkoutModal) {
    const closeCheckoutModal = () => {
      checkoutModal.classList.remove("is-visible");
      document.body.classList.remove("modal-open");
      if (checkoutNote) checkoutNote.textContent = "";
    };

    const formatColorLabel = (colors) =>
      colors?.length ? `Colores: ${colors.join(", ")}` : "";

    const normalizeTextValue = (value) =>
      typeof value === "string" ? value.trim() : "";

    const getCheckoutCustomer = () => {
      const name = normalizeTextValue(checkoutName?.value);
      const address = normalizeTextValue(checkoutAddress?.value);
      const phone = normalizeTextValue(checkoutPhone?.value);
      const notes = normalizeTextValue(checkoutNotes?.value);
      const country = normalizeTextValue(checkoutCountry?.value || "ES");
      if (!name || !address || !phone) {
        return null;
      }
      return { name, address, phone, notes, country };
    };

    const buildCheckoutPayload = () => {
      const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
      const country = checkoutCountry?.value || "ES";
      const shipping = calculateShipping(subtotal, country);
      const items = cart.map((item) => ({
        name: item.variant
          ? `${item.name} (${item.variant})`
          : item.name,
        description: formatColorLabel(item.colors),
        price: item.price,
        qty: item.qty,
      }));
      if (shipping.cost !== null && shipping.cost > 0) {
        items.push({
          name: "Envío",
          description: "Gastos de envío",
          price: shipping.cost,
          qty: 1,
        });
      }
      return {
        items,
        customer: getCheckoutCustomer(),
        shipping: {
          cost: shipping.cost,
          label: shipping.label,
        },
        currency: "EUR",
        successUrl: `${window.location.origin}/tienda.html?payment=success`,
        cancelUrl: `${window.location.origin}/tienda.html?payment=cancel`,
      };
    };

    const setCheckoutLoading = (isLoading, label) => {
      if (payWithCard instanceof HTMLButtonElement) {
        payWithCard.disabled = isLoading;
        payWithCard.classList.toggle("is-disabled", isLoading);
        if (label) payWithCard.textContent = label;
        if (!isLoading) payWithCard.textContent = "Pagar con tarjeta";
      }
      if (payWithPaypal instanceof HTMLButtonElement) {
        payWithPaypal.disabled = isLoading;
        payWithPaypal.classList.toggle("is-disabled", isLoading);
        if (label) payWithPaypal.textContent = label;
        if (!isLoading) payWithPaypal.textContent = "Pagar con PayPal";
      }
    };

    const startCheckout = async (endpoint) => {
      const payload = buildCheckoutPayload();
      if (!payload.items.length) {
        if (checkoutNote) checkoutNote.textContent = "Añade productos antes de continuar.";
        return;
      }
      if (!payload.customer) {
        if (checkoutNote) {
          checkoutNote.textContent =
            "Completa nombre, dirección y número móvil para continuar.";
        }
        return;
      }
      const customerCountry = payload.customer.country || "ES";
      if (
        customerCountry !== "ES" &&
        cart.reduce((sum, item) => sum + item.price * item.qty, 0) <
          INTERNATIONAL_MIN_ORDER
      ) {
        if (checkoutNote) {
          checkoutNote.textContent = `Pedidos internacionales desde ${formatCurrency(
            INTERNATIONAL_MIN_ORDER
          )}.`;
        }
        return;
      }

      setCheckoutLoading(true, "Preparando pago...");
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.url) {
          const message = data?.error || "No se pudo iniciar el pago. Intenta de nuevo.";
          if (checkoutNote) checkoutNote.textContent = message;
          setCheckoutLoading(false);
          return;
        }
        window.location.href = data.url;
      } catch (error) {
        if (checkoutNote) {
          checkoutNote.textContent =
            typeof error?.message === "string"
              ? `No se pudo iniciar el pago: ${error.message}`
              : "No se pudo iniciar el pago. Revisa tu conexión.";
        }
        setCheckoutLoading(false);
      }
    };

    checkoutButton.addEventListener("click", () => {
      if (checkoutButton instanceof HTMLButtonElement && checkoutButton.disabled) return;
      updateCheckoutSummary();
      checkoutModal.classList.add("is-visible");
      document.body.classList.add("modal-open");
      if (checkoutNote) checkoutNote.textContent = "";
    });

    checkoutCountry?.addEventListener("change", () => {
      const country = checkoutCountry.value;
      if (internationalNote) {
        internationalNote.classList.toggle("is-visible", country !== "ES");
      }
      renderCart();
    });

    checkoutModal.addEventListener("click", (event) => {
      if (event.target === checkoutModal) {
        closeCheckoutModal();
      }
    });

    checkoutModalClose?.addEventListener("click", closeCheckoutModal);
    payWithCard?.addEventListener("click", () => startCheckout(STRIPE_ENDPOINT));
    payWithPaypal?.addEventListener("click", () => startCheckout(PAYPAL_ENDPOINT));
  }
}

const handlePaymentReturn = async () => {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("payment");
  if (!status) return;

  if (status === "success") {
    showPaymentAlert(
      "success",
      "Pago confirmado. Tu pedido se está procesando y te contactaremos pronto."
    );
    return;
  }

  if (status === "cancel") {
    showPaymentAlert("info", "El pago fue cancelado. Puedes intentarlo de nuevo.");
  }
};

handlePaymentReturn();

if (colorModal) {
  const closeModal = () => {
    colorModal.classList.remove("is-visible");
    document.body.classList.remove("modal-open");
    colorModalForm?.reset();
    if (colorModalNote) {
      colorModalNote.textContent = "";
    }
    if (colorModalPreview) {
      colorModalPreview.style.background = "transparent";
    }
  };

  colorModal.addEventListener("click", (event) => {
    if (event.target === colorModal) {
      closeModal();
    }
  });

  colorModalClose?.addEventListener("click", closeModal);

  if (colorModalForm) {
    colorModalForm.dataset.endpoint = COLOR_ENDPOINT;
  }

  colorModalForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendFormToApi(
      colorModalForm,
      colorModalNote,
      "¡Gracias! Te contactaremos para confirmar el color."
    ).then((success) => {
      if (success) {
        setTimeout(closeModal, 1500);
      }
    });
  });

  colorModalForm?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type === "color" && colorModalPreview) {
      colorModalPreview.style.background = target.value;
    }
  });
}

if (imageModal) {
  const closeImageModal = () => {
    imageModal.classList.remove("is-visible");
    document.body.classList.remove("modal-open");
    if (imageModalImg) {
      imageModalImg.removeAttribute("src");
    }
    imageModal.removeAttribute("data-images");
    imageModal.removeAttribute("data-index");
    if (imageModalCounter) {
      imageModalCounter.textContent = "0/0";
    }
  };

  imageModal.addEventListener("click", (event) => {
    if (event.target === imageModal) {
      closeImageModal();
    }
  });

  imageModalClose?.addEventListener("click", closeImageModal);

  const showImageAt = (nextIndex) => {
    const raw = imageModal.dataset.images;
    if (!raw || !imageModalImg) return;
    const images = JSON.parse(raw);
    if (!Array.isArray(images) || !images.length) return;
    const safeIndex = ((nextIndex % images.length) + images.length) % images.length;
    imageModal.dataset.index = safeIndex.toString();
    imageModalImg.src = images[safeIndex];
    if (imageModalCounter) {
      imageModalCounter.textContent = `${safeIndex + 1}/${images.length}`;
    }
  };

  imageModalPrev?.addEventListener("click", () => {
    const current = Number(imageModal.dataset.index || "0");
    showImageAt(current - 1);
  });

  imageModalNext?.addEventListener("click", () => {
    const current = Number(imageModal.dataset.index || "0");
    showImageAt(current + 1);
  });
}
