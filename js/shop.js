import { supabase } from "./supabaseClient.js";

/**
 * Shop
 * - Public: can browse + add to cart
 * - Admins: can create/update/delete products (enforced by Supabase RLS)
 */

// Fallback seed data (used if the `products` table isn't set up yet)
const FALLBACK_PRODUCTS = [
  {
    id: "starlight-kit",
    name: "Starlight Study Kit",
    category: "Study tools",
    collection: "Astral Study",
    price: 96,
    rating: 4.9,
    stock: 9,
    tag: "Bundle",
    image: "./assets/images/hero-approach.png",
    description: "Moonlit essentials for long-form spell theory sessions.",
    details: ["Moonbeam ink vial", "Skyglass lamp", "Focus rune patch"],
  },
  {
    id: "warding-satchel",
    name: "Warding Satchel",
    category: "Protection",
    collection: "Wardcraft",
    price: 74,
    rating: 4.7,
    stock: 4,
    tag: "Best seller",
    image: "./assets/images/These_are_the_202512031938.jpeg",
    description: "Layered wards woven into a weatherproof field satchel.",
    details: ["Triple-stitched wards", "Weather seal", "Notebook divider"],
  },
  {
    id: "aurora-tea",
    name: "Aurora Calm Tea",
    category: "Wellness",
    collection: "Restorative",
    price: 32,
    rating: 4.6,
    stock: 18,
    tag: "Soothing",
    image: "./assets/images/Image_202512081359.jpeg",
    description: "Herbal blend to steady focus before summoning practice.",
    details: ["Juniper petals", "Lavender steam", "Honeyed cedar"],
  },
  {
    id: "compass-charm",
    name: "Northwind Compass Charm",
    category: "Travel",
    collection: "Fieldwork",
    price: 58,
    rating: 4.8,
    stock: 7,
    tag: "Field kit",
    image: "./assets/images/Image_202512081305.jpeg",
    description: "Guides you back to campus pathways and safe circles.",
    details: ["Glow-in-dusk dial", "Anchor rune", "Adjustable chain"],
  },
  {
    id: "ember-cloak",
    name: "Emberlined Cloak",
    category: "Apparel",
    collection: "Wardcraft",
    price: 140,
    rating: 4.9,
    stock: 2,
    tag: "Limited",
    image: "./assets/images/hero-approach.png",
    description: "Lightweight warmth with flame-resistant lining.",
    details: ["Heat-buffer weave", "Hidden pockets", "Storm fastenings"],
  },
  {
    id: "inkstone",
    name: "Runic Inkstone",
    category: "Study tools",
    collection: "Astral Study",
    price: 44,
    rating: 4.5,
    stock: 12,
    tag: "Classic",
    image: "./assets/images/Image_202512081359.jpeg",
    description: "Keeps glyph ink shimmering for late-night scripts.",
    details: ["Self-stirring basin", "Spill ward", "Includes quill rest"],
  },
  {
    id: "rift-lantern",
    name: "Rift Lantern",
    category: "Travel",
    collection: "Fieldwork",
    price: 88,
    rating: 4.4,
    stock: 0,
    tag: "Sold out",
    image: "./assets/images/These_are_the_202512031938.jpeg",
    description: "Stable light source for inter-realm expeditions.",
    details: ["Refraction cage", "Wind shield", "Two-day charge"],
  },
  {
    id: "soothe-candle",
    name: "Soothe Ember Candle",
    category: "Wellness",
    collection: "Restorative",
    price: 28,
    rating: 4.3,
    stock: 15,
    tag: "Restock",
    image: "./assets/images/hero-approach.png",
    description: "Gentle glow to reset your study focus rituals.",
    details: ["Bergamot wax", "Low-spark wick", "Reusable tin"],
  },
  {
    id: "sigil-gloves",
    name: "Sigilweave Gloves",
    category: "Apparel",
    collection: "Wardcraft",
    price: 68,
    rating: 4.7,
    stock: 6,
    tag: "New",
    image: "./assets/images/Image_202512081305.jpeg",
    description: "Tactile gloves for rune carving and potion prep.",
    details: ["Grip enchantment", "Cooling weave", "Lightweight lining"],
  },
  {
    id: "4-schools-sticker-set",
    name: "4 Schools Sticker Set",
    category: "Stickers",
    collection: "Astral Study",
    price: 7,
    rating: 5.0,
    stock: 25,
    tag: "Sticker set",
    image: "./assets/images/4-schools-sticker-set.png",
    description: "A premium vinyl set featuring the academy's four schools.",
    details: ["4 die-cut vinyl stickers", "Water-resistant", "Gloss finish"],
  },
];

// Products we always want available in the UI, even if the database is enabled.
// If you add the same `id` to the Supabase `products` table later, this won't duplicate.
const PINNED_PRODUCT_IDS = ["4-schools-sticker-set"];

function getPinnedProducts() {
  return FALLBACK_PRODUCTS.filter((product) => PINNED_PRODUCT_IDS.includes(product.id));
}

const STORAGE_KEY = "shop:cart";
const PROMO_CODE = "STARSPELL10";
const TAX_RATE = 0.075;

/** DOM */
const shopGrid = document.getElementById("shopGrid");
const shopSearch = document.getElementById("shopSearch");
const shopCategory = document.getElementById("shopCategory");
const shopCollection = document.getElementById("shopCollection");
const shopSort = document.getElementById("shopSort");
const shopMaxPrice = document.getElementById("shopMaxPrice");
const shopMaxPriceValue = document.getElementById("shopMaxPriceValue");
const shopInStock = document.getElementById("shopInStock");
const shopResultCount = document.getElementById("shopResultCount");
const resetShopFilters = document.getElementById("resetShopFilters");
const featuredBundleBtn = document.getElementById("featuredBundleBtn");

const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartStatus = document.getElementById("cartStatus");
const cartSubtotal = document.getElementById("cartSubtotal");
const cartDiscount = document.getElementById("cartDiscount");
const cartShipping = document.getElementById("cartShipping");
const cartTax = document.getElementById("cartTax");
const cartTotal = document.getElementById("cartTotal");
const promoForm = document.getElementById("promoForm");
const promoCode = document.getElementById("promoCode");
const promoStatus = document.getElementById("promoStatus");
const checkoutBtn = document.getElementById("checkoutBtn");
const checkoutStatus = document.getElementById("checkoutStatus");
const clearCart = document.getElementById("clearCart");
const shippingOptions = Array.from(document.querySelectorAll('input[name="shipping"]'));

/** State */
const state = {
  products: [...FALLBACK_PRODUCTS],
  usingDatabase: false,
  session: null,
  isAdmin: false,
};

const filters = {
  search: "",
  category: "all",
  collection: "all",
  sort: "featured",
  maxPrice: Number(shopMaxPrice?.value || 160),
  inStock: true,
};

const cartState = {
  items: {},
  shipping: "standard",
  discountPct: 0,
  promoCode: "",
};

const shippingRates = {
  standard: 8,
  express: 18,
  pickup: 0,
};

/** Utils */
function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function clampNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const num = Number(value);
  if (Number.isNaN(num)) return min;
  return Math.min(Math.max(num, min), max);
}

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

function uniqueIdFromName(name) {
  const base = slugify(name) || "product";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

/** Cart persistence */
function loadCart() {
  if (!localStorage) return;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return;
    cartState.items = saved.items || {};
    cartState.shipping = saved.shipping || "standard";
    cartState.discountPct = saved.discountPct || 0;
    cartState.promoCode = saved.promoCode || "";
  } catch (error) {
    console.warn("Unable to read cart", error);
  }
}

function saveCart() {
  if (!localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cartState));
  } catch (error) {
    console.warn("Unable to save cart", error);
  }
}

/** Products */
function getProduct(id) {
  return state.products.find((product) => product.id === id);
}

function getFilteredProducts() {
  const searchTerm = filters.search.toLowerCase();

  // Always float stickers to the top of the catalog (even when sorting).
  // This keeps sticker drops visible without breaking the rest of the filters.
  const isSticker = (product) => {
    const category = String(product?.category || "").toLowerCase();
    const tag = String(product?.tag || "").toLowerCase();
    const name = String(product?.name || "").toLowerCase();
    return category.includes("sticker") || tag.includes("sticker") || name.includes("sticker");
  };

  const compareBySelectedSort = (a, b) => {
    switch (filters.sort) {
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "rating-desc":
        return (b.rating || 0) - (a.rating || 0);
      case "name-asc":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  };

  return state.products
    .filter((product) => {
      if (filters.category !== "all" && product.category !== filters.category) return false;
      if (filters.collection !== "all" && product.collection !== filters.collection) return false;
      if (filters.inStock && product.stock === 0) return false;
      if (product.price > filters.maxPrice) return false;
      if (!searchTerm) return true;
      const haystack = `${product.name} ${product.description} ${(product.details || []).join(" ")}`.toLowerCase();
      return haystack.includes(searchTerm);
    })
    .sort((a, b) => {
      const stickerDelta = Number(isSticker(b)) - Number(isSticker(a));
      if (stickerDelta !== 0) return stickerDelta;
      return compareBySelectedSort(a, b);
    });
}

function updateResultCount(count) {
  if (!shopResultCount) return;
  shopResultCount.textContent = `${count} item${count === 1 ? "" : "s"} ready for pickup`;
}

function getCartItems() {
  return Object.entries(cartState.items)
    .map(([id, qty]) => ({ product: getProduct(id), qty }))
    .filter(({ product }) => Boolean(product));
}

function setCartStatus(message) {
  if (!cartStatus) return;
  cartStatus.textContent = message || "";
}

function updateCartSummary() {
  const items = getCartItems();
  const subtotalValue = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const discountValue = subtotalValue * cartState.discountPct;
  const shippingValue = shippingRates[cartState.shipping] || 0;
  const taxedAmount = Math.max(subtotalValue - discountValue, 0);
  const taxValue = taxedAmount * TAX_RATE;
  const totalValue = taxedAmount + shippingValue + taxValue;

  if (cartSubtotal) cartSubtotal.textContent = formatCurrency(subtotalValue);
  if (cartDiscount) cartDiscount.textContent = `-${formatCurrency(discountValue)}`;
  if (cartShipping) cartShipping.textContent = formatCurrency(shippingValue);
  if (cartTax) cartTax.textContent = formatCurrency(taxValue);
  if (cartTotal) cartTotal.textContent = formatCurrency(totalValue);
  if (cartCount) {
    const count = items.reduce((sum, item) => sum + item.qty, 0);
    cartCount.textContent = `${count} item${count === 1 ? "" : "s"}`;
  }
}

function renderCart() {
  if (!cartItems) return;
  const items = getCartItems();
  cartItems.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Your satchel is empty. Add an item to begin.";
    cartItems.appendChild(empty);
  } else {
    items.forEach(({ product, qty }) => {
      const item = document.createElement("div");
      item.className = "cartItem";
      item.dataset.productId = product.id;
      item.innerHTML = `
        <div class="cartItemRow">
          <div>
            <strong>${product.name}</strong>
            <p class="muted small">${product.collection}</p>
            <p class="muted small">${formatCurrency(product.price)} each</p>
          </div>
          <div class="cartItemControls">
            <button class="iconBtn" type="button" data-action="decrease">−</button>
            <span class="cartQty">${qty}</span>
            <button class="iconBtn" type="button" data-action="increase">+</button>
          </div>
        </div>
        <button class="cartRemove" type="button" data-action="remove">Remove</button>
      `;
      cartItems.appendChild(item);
    });
  }

  updateCartSummary();
  saveCart();
}

function updateShippingSelection() {
  shippingOptions.forEach((option) => {
    option.checked = option.value === cartState.shipping;
  });
}

function addToCart(productId) {
  const product = getProduct(productId);
  if (!product) return;
  const currentQty = cartState.items[productId] || 0;
  if (currentQty >= product.stock) {
    setCartStatus("That item is at its current stock limit.");
    return;
  }
  cartState.items[productId] = currentQty + 1;
  setCartStatus(`${product.name} added to your cart.`);
  renderCart();
}

function updateCartQuantity(productId, delta) {
  const product = getProduct(productId);
  if (!product) return;
  const currentQty = cartState.items[productId] || 0;
  const nextQty = currentQty + delta;
  if (nextQty <= 0) {
    delete cartState.items[productId];
    setCartStatus(`${product.name} removed.`);
  } else if (nextQty > product.stock) {
    setCartStatus("That item is at its current stock limit.");
    return;
  } else {
    cartState.items[productId] = nextQty;
    setCartStatus("Cart updated.");
  }
  renderCart();
}

function applyPromo(code) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    cartState.discountPct = 0;
    cartState.promoCode = "";
    promoStatus.textContent = "Promo cleared.";
    updateCartSummary();
    saveCart();
    return;
  }
  if (normalized === PROMO_CODE) {
    cartState.discountPct = 0.1;
    cartState.promoCode = normalized;
    promoStatus.textContent = "Code applied: 10% off your order.";
  } else {
    cartState.discountPct = 0;
    cartState.promoCode = normalized;
    promoStatus.textContent = "That code isn't recognized yet.";
  }
  updateCartSummary();
  saveCart();
}

function handleCheckout() {
  const items = getCartItems();
  if (items.length === 0) {
    checkoutStatus.textContent = "Add items before checking out.";
    return;
  }
  checkoutStatus.textContent = "Checkout complete! A messenger owl is on the way with your receipt.";
}

/** Filters */
function updateMaxPriceLabel() {
  if (!shopMaxPriceValue || !shopMaxPrice) return;
  const value = Number(shopMaxPrice.value);
  shopMaxPriceValue.textContent = `Up to $${value}`;
}

function syncMaxPriceRangeFromProducts() {
  if (!(shopMaxPrice instanceof HTMLInputElement)) return;
  const max = Math.max(...state.products.map((p) => Number(p.price) || 0), 0);
  const rounded = Math.max(20, Math.ceil(max / 5) * 5);
  shopMaxPrice.max = String(rounded);
  if (Number(shopMaxPrice.value) > rounded) shopMaxPrice.value = String(rounded);
  if (filters.maxPrice > rounded) filters.maxPrice = rounded;
  updateMaxPriceLabel();
}

function updateFiltersFromInputs() {
  if (shopSearch) filters.search = shopSearch.value.trim();
  if (shopCategory) filters.category = shopCategory.value;
  if (shopCollection) filters.collection = shopCollection.value;
  if (shopSort) filters.sort = shopSort.value;
  if (shopMaxPrice) filters.maxPrice = Number(shopMaxPrice.value);
  if (shopInStock) filters.inStock = shopInStock.checked;
  updateMaxPriceLabel();
  renderProducts();
}

function resetFilters() {
  if (shopSearch) shopSearch.value = "";
  if (shopCategory) shopCategory.value = "all";
  if (shopCollection) shopCollection.value = "all";
  if (shopSort) shopSort.value = "featured";
  if (shopMaxPrice) shopMaxPrice.value = shopMaxPrice.max || "160";
  if (shopInStock) shopInStock.checked = true;
  updateFiltersFromInputs();
}

/** Admin UI */
let adminBarEl = null;
let overlayEl = null;
let overlayFormEl = null;
let overlayStatusEl = null;

function ensureAdminBar() {
  if (adminBarEl || !shopResultCount) return;
  const row = shopResultCount.closest(".shopResultsRow");
  if (!row) return;

  adminBarEl = document.createElement("div");
  adminBarEl.className = "shopAdminBar";
  adminBarEl.innerHTML = `
    <span class="shopAdminPill" title="Only admins can edit products (enforced by Supabase RLS).">Admin mode</span>
    <button class="btn ghost" type="button" data-action="admin-add">Add product</button>
    <span class="muted small" data-admin-note></span>
  `;

  row.insertBefore(adminBarEl, row.lastElementChild);
}

function setAdminBarVisible(visible, note = "") {
  if (!adminBarEl) return;
  adminBarEl.style.display = visible ? "flex" : "none";
  const noteEl = adminBarEl.querySelector("[data-admin-note]");
  if (noteEl) noteEl.textContent = note;
}

function ensureOverlay() {
  if (overlayEl) return;

  overlayEl = document.createElement("div");
  overlayEl.className = "shopAdminOverlay";
  overlayEl.setAttribute("aria-hidden", "true");
  overlayEl.innerHTML = `
    <div class="shopAdminCard" role="dialog" aria-modal="true" aria-label="Edit product">
      <div class="shopAdminHeader">
        <div>
          <p class="sigil">Quartermaster console</p>
          <h3 class="shopAdminTitle">Edit product</h3>
        </div>
        <button class="btn ghost" type="button" data-action="admin-close">Close</button>
      </div>

      <form class="shopAdminForm" id="shopAdminForm">
        <div class="shopAdminGrid">
          <div class="field">
            <label for="adminProductId">ID</label>
            <input id="adminProductId" name="id" type="text" autocomplete="off" />
            <p class="muted small">Stable identifier used in the cart. Avoid changing it once live.</p>
          </div>
          <div class="field">
            <label for="adminProductName">Name</label>
            <input id="adminProductName" name="name" type="text" required />
          </div>
          <div class="field">
            <label for="adminProductCategory">Category</label>
            <input id="adminProductCategory" name="category" type="text" placeholder="Study tools" required />
          </div>
          <div class="field">
            <label for="adminProductCollection">Collection</label>
            <input id="adminProductCollection" name="collection" type="text" placeholder="Astral Study" required />
          </div>
          <div class="field">
            <label for="adminProductPrice">Price</label>
            <input id="adminProductPrice" name="price" type="number" min="0" step="1" required />
          </div>
          <div class="field">
            <label for="adminProductStock">Stock</label>
            <input id="adminProductStock" name="stock" type="number" min="0" step="1" required />
          </div>
          <div class="field">
            <label for="adminProductRating">Rating</label>
            <input id="adminProductRating" name="rating" type="number" min="0" max="5" step="0.1" />
          </div>
          <div class="field">
            <label for="adminProductTag">Tag</label>
            <input id="adminProductTag" name="tag" type="text" placeholder="New" />
          </div>
          <div class="field">
            <label for="adminProductImage">Image URL / path</label>
            <input id="adminProductImage" name="image" type="text" placeholder="./assets/images/hero.png" />
          </div>
          <div class="field">
            <label for="adminProductDescription">Description</label>
            <textarea id="adminProductDescription" name="description" rows="3"></textarea>
          </div>
          <div class="field">
            <label for="adminProductDetails">Details (one per line)</label>
            <textarea id="adminProductDetails" name="details" rows="4"></textarea>
          </div>
        </div>

        <p class="muted small" id="shopAdminStatus"></p>

        <div class="shopAdminActions">
          <button class="btn primary magentaGlow" type="submit" data-action="admin-save">Save</button>
          <button class="btn ghost" type="button" data-action="admin-delete">Delete</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlayEl);
  overlayFormEl = overlayEl.querySelector("#shopAdminForm");
  overlayStatusEl = overlayEl.querySelector("#shopAdminStatus");

  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) closeOverlay();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlayEl?.classList.contains("open")) closeOverlay();
  });

  overlayEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action === "admin-close") closeOverlay();
  });
}

let overlayMode = "edit"; // 'edit' | 'create'

function setOverlayStatus(message, tone = "muted") {
  if (!(overlayStatusEl instanceof HTMLElement)) return;
  overlayStatusEl.textContent = message || "";
  overlayStatusEl.className = `${tone} small`;
}

function openOverlay(product = null, mode = "edit") {
  if (!state.isAdmin) return;
  ensureOverlay();
  if (!overlayEl || !overlayFormEl) return;

  overlayMode = mode;
  const title = overlayEl.querySelector(".shopAdminTitle");
  if (title) title.textContent = mode === "create" ? "Add product" : "Edit product";

  const idInput = overlayFormEl.querySelector("#adminProductId");
  const nameInput = overlayFormEl.querySelector("#adminProductName");
  const categoryInput = overlayFormEl.querySelector("#adminProductCategory");
  const collectionInput = overlayFormEl.querySelector("#adminProductCollection");
  const priceInput = overlayFormEl.querySelector("#adminProductPrice");
  const stockInput = overlayFormEl.querySelector("#adminProductStock");
  const ratingInput = overlayFormEl.querySelector("#adminProductRating");
  const tagInput = overlayFormEl.querySelector("#adminProductTag");
  const imageInput = overlayFormEl.querySelector("#adminProductImage");
  const descInput = overlayFormEl.querySelector("#adminProductDescription");
  const detailsInput = overlayFormEl.querySelector("#adminProductDetails");
  const deleteBtn = overlayFormEl.querySelector('[data-action="admin-delete"]');

  const next =
    product ||
    ({
      id: "",
      name: "",
      category: "Study tools",
      collection: "Astral Study",
      price: 40,
      stock: 10,
      rating: 4.6,
      tag: "New",
      image: "",
      description: "",
      details: [],
    });

  if (idInput instanceof HTMLInputElement) {
    idInput.value = next.id || "";
    idInput.disabled = mode !== "create";
    idInput.placeholder = mode === "create" ? "e.g. starlight-kit" : "";
  }
  if (nameInput instanceof HTMLInputElement) nameInput.value = next.name || "";
  if (categoryInput instanceof HTMLInputElement) categoryInput.value = next.category || "";
  if (collectionInput instanceof HTMLInputElement) collectionInput.value = next.collection || "";
  if (priceInput instanceof HTMLInputElement) priceInput.value = String(next.price ?? "");
  if (stockInput instanceof HTMLInputElement) stockInput.value = String(next.stock ?? "");
  if (ratingInput instanceof HTMLInputElement) ratingInput.value = String(next.rating ?? "");
  if (tagInput instanceof HTMLInputElement) tagInput.value = next.tag || "";
  if (imageInput instanceof HTMLInputElement) imageInput.value = next.image || "";
  if (descInput instanceof HTMLTextAreaElement) descInput.value = next.description || "";
  if (detailsInput instanceof HTMLTextAreaElement) detailsInput.value = (next.details || []).join("\n");

  if (deleteBtn instanceof HTMLButtonElement) {
    deleteBtn.disabled = mode === "create";
    deleteBtn.classList.toggle("danger", mode !== "create");
  }

  setOverlayStatus(state.usingDatabase ? "" : "Database table not detected. Run the SQL setup first.");

  overlayEl.classList.add("open");
  overlayEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("isEditingShopProduct");
  setTimeout(() => nameInput?.focus?.(), 25);
}

function closeOverlay() {
  if (!overlayEl) return;
  overlayEl.classList.remove("open");
  overlayEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("isEditingShopProduct");
  setOverlayStatus("");
}

async function saveFromOverlay() {
  if (!state.isAdmin) return;
  if (!overlayFormEl) return;

  if (!state.usingDatabase) {
    setOverlayStatus("This site is still using fallback mock products. Create the `products` table to enable editing.", "error");
    return;
  }

  const formData = new FormData(overlayFormEl);
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const collection = String(formData.get("collection") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const tag = String(formData.get("tag") || "").trim();
  const image = String(formData.get("image") || "").trim();
  const detailsText = String(formData.get("details") || "");
  const details = detailsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const price = clampNumber(formData.get("price"), { min: 0 });
  const stock = Math.round(clampNumber(formData.get("stock"), { min: 0 }));
  const rating = clampNumber(formData.get("rating"), { min: 0, max: 5 });

  if (!name) {
    setOverlayStatus("Name is required.", "error");
    return;
  }

  const payload = {
    name,
    category,
    collection,
    description,
    tag,
    image,
    details,
    price,
    stock,
    rating,
  };

  setOverlayStatus("Saving...", "muted");

  try {
    if (overlayMode === "create") {
      const idFromForm = String(formData.get("id") || "").trim();
      const id = idFromForm || uniqueIdFromName(name);
      const { error } = await supabase.from("products").insert([{ id, ...payload }]);
      if (error) throw error;
      setOverlayStatus("Created.");
    } else {
      const id = String(formData.get("id") || "").trim();
      if (!id) {
        setOverlayStatus("Missing product ID.", "error");
        return;
      }
      const { error } = await supabase.from("products").update(payload).eq("id", id);
      if (error) throw error;
      setOverlayStatus("Saved.");
    }

    await refreshProductsFromDatabase();
    syncMaxPriceRangeFromProducts();
    renderProducts();
    closeOverlay();
  } catch (error) {
    console.error("Unable to save product", error);
    setOverlayStatus(error?.message || "Unable to save. Check your admin role + RLS policies.", "error");
  }
}

async function deleteFromOverlay() {
  if (!state.isAdmin) return;
  if (!overlayFormEl) return;
  if (!state.usingDatabase) {
    setOverlayStatus("Cannot delete while using fallback mock products.", "error");
    return;
  }

  const formData = new FormData(overlayFormEl);
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  const ok = window.confirm("Delete this product? This cannot be undone.");
  if (!ok) return;

  setOverlayStatus("Deleting...", "muted");
  try {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    // if the product is in the cart, remove it
    if (cartState.items[id]) delete cartState.items[id];
    await refreshProductsFromDatabase();
    syncMaxPriceRangeFromProducts();
    renderProducts();
    renderCart();
    closeOverlay();
  } catch (error) {
    console.error("Unable to delete", error);
    setOverlayStatus(error?.message || "Unable to delete. Check your admin role + RLS policies.", "error");
  }
}

function wireOverlayHandlers() {
  if (!overlayEl) return;
  overlayFormEl?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveFromOverlay();
  });

  overlayEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action === "admin-delete") deleteFromOverlay();
  });
}

/** Rendering */
function renderProducts() {
  if (!shopGrid) return;

  const products = getFilteredProducts();
  shopGrid.innerHTML = "";
  updateResultCount(products.length);

  if (products.length === 0) {
    const empty = document.createElement("div");
    empty.className = "shopEmpty";
    empty.textContent = "No items match these filters. Try widening the range or clearing the search.";
    shopGrid.appendChild(empty);
    return;
  }

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "shopItem";
    card.dataset.productId = product.id;

    const stockLabel = product.stock > 0 ? `${product.stock} in stock` : "Waitlist";
    const stockClass = product.stock > 0 ? "" : "muted";

    const adminEditBtn = state.isAdmin
      ? `<button class="btn ghost" type="button" data-action="edit">Edit</button>`
      : "";

    card.innerHTML = `
      <div class="shopItemMedia">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
        <span class="shopTag">${product.tag || "Item"}</span>
      </div>
      <div class="shopItemBody">
        <div class="shopItemHeader">
          <h3>${product.name}</h3>
          <span class="shopPrice">${formatCurrency(product.price)}</span>
        </div>
        <p class="muted">${product.description || ""}</p>
        <div class="shopMetaRow">
          <span>★ ${(product.rating ?? 0).toFixed(1)}</span>
          <span class="${stockClass}">${stockLabel}</span>
          <span>${product.collection}</span>
        </div>
      </div>
      <div class="shopItemActions">
        <button class="btn ghost" type="button" data-action="details" aria-expanded="false">Details</button>
        ${adminEditBtn}
        <button class="btn primary" type="button" data-action="add" ${product.stock === 0 ? "disabled" : ""}>
          ${product.stock === 0 ? "Join waitlist" : "Add to cart"}
        </button>
      </div>
      <div class="shopItemDetails" hidden>
        <p class="muted small">Includes:</p>
        <ul>
          ${(product.details || []).map((detail) => `<li>${detail}</li>`).join("")}
        </ul>
      </div>
    `;

    shopGrid.appendChild(card);
  });
}

/** Supabase: admin + product loading */
async function refreshAdminState(session) {
  state.session = session;
  state.isAdmin = false;

  if (!session?.user) {
    ensureAdminBar();
    setAdminBarVisible(false);
    renderProducts();
    return;
  }

  // Admin is determined by profiles.is_admin = true
  try {
    const { data, error } = await supabase.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle();

    if (error) {
      // If the profiles table isn't set up yet, stay non-admin.
      console.warn("Admin role check failed", error);
      ensureAdminBar();
      setAdminBarVisible(false);
      renderProducts();
      return;
    }

    state.isAdmin = Boolean(data?.is_admin);
    ensureAdminBar();
    setAdminBarVisible(state.isAdmin, state.usingDatabase ? "" : "(Run DB setup to enable editing)");
    renderProducts();
  } catch (error) {
    console.warn("Admin role check crashed", error);
    ensureAdminBar();
    setAdminBarVisible(false);
  }
}

function normalizeProductRow(row) {
  const details = Array.isArray(row.details) ? row.details : typeof row.details === "string" ? [row.details] : [];
  return {
    id: String(row.id),
    name: row.name ?? "",
    category: row.category ?? "",
    collection: row.collection ?? "",
    price: Number(row.price) || 0,
    rating: Number(row.rating) || 0,
    stock: Number(row.stock) || 0,
    tag: row.tag ?? "",
    image: row.image ?? "",
    description: row.description ?? "",
    details,
  };
}

async function refreshProductsFromDatabase() {
  state.usingDatabase = false;
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, collection, price, rating, stock, tag, image, description, details")
      .order("name", { ascending: true });

    if (error) throw error;
    if (Array.isArray(data)) {
      const dbProducts = data.map(normalizeProductRow);
      const knownIds = new Set(dbProducts.map((p) => p.id));
      const pinned = getPinnedProducts().filter((p) => !knownIds.has(p.id));
      state.products = [...dbProducts, ...pinned];
      state.usingDatabase = true;
    }
  } catch (error) {
    // Table may not exist yet, or RLS prevents access. Keep fallback.
    console.warn("Using fallback shop products", error);
    state.products = [...FALLBACK_PRODUCTS];
    state.usingDatabase = false;
  }
}

/** Event wiring */
shopGrid?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const card = target.closest(".shopItem");
  if (!card) return;
  const productId = card.dataset.productId;
  if (!productId) return;

  if (target.dataset.action === "add") {
    addToCart(productId);
  }

  if (target.dataset.action === "details") {
    const details = card.querySelector(".shopItemDetails");
    if (!details) return;
    const isHidden = details.hasAttribute("hidden");
    if (isHidden) {
      details.removeAttribute("hidden");
    } else {
      details.setAttribute("hidden", "");
    }
    target.setAttribute("aria-expanded", String(isHidden));
  }

  if (target.dataset.action === "edit") {
    const product = getProduct(productId);
    openOverlay(product, "edit");
  }
});

cartItems?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const item = target.closest(".cartItem");
  if (!item) return;
  const productId = item.dataset.productId;
  if (!productId) return;

  if (target.dataset.action === "increase") {
    updateCartQuantity(productId, 1);
  }
  if (target.dataset.action === "decrease") {
    updateCartQuantity(productId, -1);
  }
  if (target.dataset.action === "remove") {
    delete cartState.items[productId];
    setCartStatus("Item removed.");
    renderCart();
  }
});

shippingOptions.forEach((option) => {
  option.addEventListener("change", () => {
    cartState.shipping = option.value;
    updateCartSummary();
    saveCart();
  });
});

promoForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!promoCode) return;
  applyPromo(promoCode.value);
});

checkoutBtn?.addEventListener("click", handleCheckout);

clearCart?.addEventListener("click", () => {
  cartState.items = {};
  setCartStatus("Cart cleared.");
  renderCart();
});

featuredBundleBtn?.addEventListener("click", () => addToCart("starlight-kit"));

[shopSearch, shopCategory, shopCollection, shopSort, shopMaxPrice, shopInStock].forEach((input) => {
  input?.addEventListener("input", updateFiltersFromInputs);
  input?.addEventListener("change", updateFiltersFromInputs);
});

resetShopFilters?.addEventListener("click", resetFilters);

// Admin bar interactions
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.action !== "admin-add") return;
  openOverlay(null, "create");
});

/** Boot */
async function init() {
  ensureAdminBar();
  setAdminBarVisible(false);

  loadCart();

  await refreshProductsFromDatabase();
  syncMaxPriceRangeFromProducts();
  updateFiltersFromInputs();
  updateShippingSelection();
  renderCart();
  if (promoCode) promoCode.value = cartState.promoCode || "";
  if (cartState.promoCode) applyPromo(cartState.promoCode);

  ensureOverlay();
  wireOverlayHandlers();

  const { data } = await supabase.auth.getSession();
  await refreshAdminState(data?.session || null);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    await refreshAdminState(session);
  });
}

init();
