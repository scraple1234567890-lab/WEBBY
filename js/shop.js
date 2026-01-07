const SHOP_PRODUCTS = [
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
];

const STORAGE_KEY = "shop:cart";
const PROMO_CODE = "STARSPELL10";
const TAX_RATE = 0.075;

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

const defaultFilters = {
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

function formatCurrency(value) {
  return `${Math.round(value).toLocaleString()} astral crowns`;
}

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

function getProduct(id) {
  return SHOP_PRODUCTS.find((product) => product.id === id);
}

function getFilteredProducts() {
  const searchTerm = defaultFilters.search.toLowerCase();
  return SHOP_PRODUCTS.filter((product) => {
    if (defaultFilters.category !== "all" && product.category !== defaultFilters.category) return false;
    if (defaultFilters.collection !== "all" && product.collection !== defaultFilters.collection) return false;
    if (defaultFilters.inStock && product.stock === 0) return false;
    if (product.price > defaultFilters.maxPrice) return false;
    if (!searchTerm) return true;
    const haystack = `${product.name} ${product.description} ${product.details.join(" ")}`.toLowerCase();
    return haystack.includes(searchTerm);
  }).sort((a, b) => {
    switch (defaultFilters.sort) {
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "rating-desc":
        return b.rating - a.rating;
      case "name-asc":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });
}

function updateResultCount(count) {
  if (!shopResultCount) return;
  shopResultCount.textContent = `${count} item${count === 1 ? "" : "s"} ready for pickup`;
}

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

    card.innerHTML = `
      <div class="shopItemMedia">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
        <span class="shopTag">${product.tag}</span>
      </div>
      <div class="shopItemBody">
        <div class="shopItemHeader">
          <h3>${product.name}</h3>
          <span class="shopPrice">${formatCurrency(product.price)}</span>
        </div>
        <p class="muted">${product.description}</p>
        <div class="shopMetaRow">
          <span>★ ${product.rating.toFixed(1)}</span>
          <span class="${stockClass}">${stockLabel}</span>
          <span>${product.collection}</span>
        </div>
      </div>
      <div class="shopItemActions">
        <button class="btn ghost" type="button" data-action="details" aria-expanded="false">Details</button>
        <button class="btn primary" type="button" data-action="add" ${product.stock === 0 ? "disabled" : ""}>
          ${product.stock === 0 ? "Join waitlist" : "Add to cart"}
        </button>
      </div>
      <div class="shopItemDetails" hidden>
        <p class="muted small">Includes:</p>
        <ul>
          ${product.details.map((detail) => `<li>${detail}</li>`).join("")}
        </ul>
      </div>
    `;

    shopGrid.appendChild(card);
  });
}

function updateMaxPriceLabel() {
  if (!shopMaxPriceValue || !shopMaxPrice) return;
  const value = Number(shopMaxPrice.value);
  shopMaxPriceValue.textContent = `Up to ${value} astral crowns`;
}

function updateFiltersFromInputs() {
  if (shopSearch) defaultFilters.search = shopSearch.value.trim();
  if (shopCategory) defaultFilters.category = shopCategory.value;
  if (shopCollection) defaultFilters.collection = shopCollection.value;
  if (shopSort) defaultFilters.sort = shopSort.value;
  if (shopMaxPrice) defaultFilters.maxPrice = Number(shopMaxPrice.value);
  if (shopInStock) defaultFilters.inStock = shopInStock.checked;
  updateMaxPriceLabel();
  renderProducts();
}

function resetFilters() {
  if (shopSearch) shopSearch.value = "";
  if (shopCategory) shopCategory.value = "all";
  if (shopCollection) shopCollection.value = "all";
  if (shopSort) shopSort.value = "featured";
  if (shopMaxPrice) shopMaxPrice.value = "160";
  if (shopInStock) shopInStock.checked = true;
  updateFiltersFromInputs();
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

loadCart();
updateFiltersFromInputs();
updateShippingSelection();
renderCart();
if (promoCode) promoCode.value = cartState.promoCode || "";
if (cartState.promoCode) applyPromo(cartState.promoCode);
