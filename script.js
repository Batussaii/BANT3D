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
      const colorLine = item.color ? `<div class="muted">Color: ${item.color}</div>` : "";
      row.innerHTML = `
        <div>
          <strong>${item.name}</strong>
          <div class="muted">x${item.qty}</div>
          ${colorLine}
        </div>
        <button type="button" data-remove="${item.id}">Quitar</button>
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

  const addToCart = (product) => {
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ ...product, qty: 1 });
    }
    renderCart();
  };

  const renderColorOptions = (card) => {
    const isCustom = card.dataset.custom === "true";
    if (!isCustom) return;

    const info = card.querySelector(".store-info");
    const addButton = card.querySelector(".add-to-cart");
    if (!info || !(addButton instanceof HTMLButtonElement)) return;

    const wrapper = document.createElement("label");
    wrapper.className = "color-select";
    wrapper.innerHTML = `
      Color disponible
      <div class="color-swatches" role="listbox" aria-label="Selecciona un color"></div>
      <p class="color-help">
        Mas Colores a
        <button type="button" class="color-link" data-open-color-modal>
          CONSULTAR
        </button>
      </p>
    `;

    const swatchContainer = wrapper.querySelector(".color-swatches");
    if (!(swatchContainer instanceof HTMLElement)) return;

    AVAILABLE_COLORS.forEach((hex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-swatch";
      button.style.background = hex;
      button.setAttribute("role", "option");
      button.setAttribute("aria-label", `Color ${hex.toUpperCase()}`);
      button.dataset.color = hex;
      swatchContainer.appendChild(button);
    });

    addButton.disabled = true;
    addButton.classList.add("is-disabled");

    swatchContainer.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const value = target.dataset.color;
      if (!value) return;
      card.dataset.selectedColor = value;
      addButton.disabled = false;
      addButton.classList.remove("is-disabled");
      swatchContainer.querySelectorAll(".color-swatch").forEach((swatch) => {
        swatch.classList.toggle("is-selected", swatch === target);
      });
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

  const removeFromCart = (id) => {
    const index = cart.findIndex((item) => item.id === id);
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
      const image = card.querySelector("[data-store-image]");
      if (!(image instanceof HTMLImageElement) || !image.src) return;
      imageModalImg.src = image.src;
      imageModal.classList.add("is-visible");
      document.body.classList.add("modal-open");
      return;
    }
    if (target.classList.contains("add-to-cart")) {
      const card = target.closest("[data-product]");
      if (!card) return;
      const selectedColor = card.dataset.selectedColor || "";
      if (card.dataset.custom === "true" && !selectedColor) {
        return;
      }
      addToCart({
        id: card.dataset.id || "",
        name: card.dataset.name || "Producto",
        price: Number(card.dataset.price || 0),
        color: selectedColor,
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
  };

  imageModal.addEventListener("click", (event) => {
    if (event.target === imageModal) {
      closeImageModal();
    }
  });

  imageModalClose?.addEventListener("click", closeImageModal);
}
