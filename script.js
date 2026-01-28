const form = document.getElementById("customRequestForm");
const formNote = document.getElementById("formNote");
const slider = document.querySelector(".products-bg-slider");
const storeProducts = document.getElementById("storeProducts");
const storeCategories = document.getElementById("storeCategories");
const storeSearch = document.getElementById("storeSearch");
const storePrice = document.getElementById("storePrice");
const cartList = document.getElementById("cartList");
const cartTotal = document.getElementById("cartTotal");
const colorModal = document.getElementById("colorRequestModal");
const colorModalForm = document.getElementById("colorRequestForm");
const colorModalClose = document.getElementById("colorModalClose");
const colorModalProduct = document.getElementById("colorModalProduct");
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
  "#ffff26",
];
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
};
const sliderDirectory = "assets/SliderIndex/";
const fallbackImages = [
  "assets/SliderIndex/test1.png",
  "assets/SliderIndex/test2.png",
  "assets/SliderIndex/test3.png",
  "assets/SliderIndex/test4.png",
  "assets/SliderIndex/test5.png",
];

const SLIDE_INTERVAL_MS = 7000;
let sliderTimer = null;

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

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    formNote.textContent =
      "¡Gracias! Tu solicitud fue enviada. Te responderemos muy pronto.";
    form.reset();
  });
}

loadSliderImages();

if (storeProducts) {
  const products = Array.from(storeProducts.querySelectorAll("[data-product]"));
  const cart = [];
  let activeCategory = "all";

  const formatCurrency = (value) => `$${value.toFixed(0)}`;

  const renderCart = () => {
    if (!cartList || !cartTotal) return;
    cartList.innerHTML = "";

    if (!cart.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No hay productos todavía.";
      cartList.appendChild(empty);
      cartTotal.textContent = "$0";
      return;
    }

    let total = 0;
    cart.forEach((item) => {
      total += item.price * item.qty;
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

    cartTotal.textContent = formatCurrency(total);
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
}

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

  colorModalForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (colorModalNote) {
      colorModalNote.textContent =
        "¡Gracias! Te contactaremos para confirmar el color.";
    }
    setTimeout(closeModal, 1500);
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
