const CART_KEY = "simple-store-cart";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const countElement = document.getElementById("cart-count");
  if (!countElement) return;

  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  countElement.textContent = count;
}

function setMessage(message) {
  const element = document.getElementById("message");
  if (element) element.textContent = message;
}

function formatPrice(price) {
  return `$${Number(price).toFixed(2)}`;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

async function loadProducts() {
  const container = document.getElementById("products");
  if (!container) return;

  try {
    const products = await api("/api/products");

    container.innerHTML = products.map((product) => `
      <article class="product-card">
        <a href="/product.html?id=${product.id}">
          <img src="${product.image}" alt="${product.name}">
        </a>
        <div class="product-card-content">
          <h3><a href="/product.html?id=${product.id}">${product.name}</a></h3>
          <p>${product.description}</p>
          <p class="price">${formatPrice(product.price)}</p>
          <button type="button" data-add="${product.id}">Add to cart</button>
        </div>
      </article>
    `).join("");

    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-add]");
      if (!button) return;
      addToCart(Number(button.dataset.add));
    });
  } catch (error) {
    setMessage(error.message);
  }
}

function addToCart(productId) {
  const cart = getCart();
  const existingItem = cart.find((item) => item.productId === productId);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ productId, quantity: 1 });
  }

  saveCart(cart);
  setMessage("Added to cart.");
}

async function loadCart() {
  const container = document.getElementById("cart-items");
  const summary = document.getElementById("cart-summary");
  if (!container || !summary) return;

  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = "<p>Your cart is empty. <a href='/'>Browse products</a>.</p>";
    summary.innerHTML = "";
    return;
  }

  try {
    const products = await api("/api/products");
    const productMap = new Map(products.map((product) => [product.id, product]));
    const validCart = cart.filter((item) => productMap.has(item.productId));

    if (validCart.length !== cart.length) saveCart(validCart);

    container.innerHTML = validCart.map((item) => {
      const product = productMap.get(item.productId);

      return `
        <div class="cart-row">
          <div>
            <strong>${product.name}</strong>
            <div>${formatPrice(product.price)} each</div>
          </div>
          <label>Qty
            <input type="number" min="1" max="99" value="${item.quantity}" data-quantity="${item.productId}">
          </label>
          <button type="button" class="secondary remove-button" data-remove="${item.productId}">Remove</button>
        </div>
      `;
    }).join("");

    const total = validCart.reduce((sum, item) => {
      return sum + productMap.get(item.productId).price * item.quantity;
    }, 0);

    summary.innerHTML = `
      <p class="cart-total">Total: ${formatPrice(total)}</p>
      <button type="button" id="checkout-button">Place order</button>
    `;

    container.addEventListener("change", (event) => {
      const input = event.target.closest("[data-quantity]");
      if (!input) return;

      const quantity = Math.max(1, Math.min(99, Number(input.value) || 1));
      const updated = getCart().map((item) =>
        item.productId === Number(input.dataset.quantity) ? { ...item, quantity } : item
      );

      saveCart(updated);
      loadCart();
    });

    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove]");
      if (!button) return;

      const productId = Number(button.dataset.remove);
      saveCart(getCart().filter((item) => item.productId !== productId));
      loadCart();
    });

    document.getElementById("checkout-button").addEventListener("click", checkout);
  } catch (error) {
    setMessage(error.message);
  }
}

async function checkout() {
  try {
    const result = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({ items: getCart() })
    });

    saveCart([]);
    setMessage(`Order #${result.orderId} placed. Total: ${formatPrice(result.total)}.`);
    loadCart();
  } catch (error) {
    if (error.message === "Please log in first.") {
      window.location.href = "/login.html";
      return;
    }
    setMessage(error.message);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password")
      })
    });

    window.location.href = "/";
  } catch (error) {
    setMessage(error.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password")
      })
    });

    window.location.href = "/";
  } catch (error) {
    setMessage(error.message);
  }
}

async function updateAccountLink() {
  const link = document.getElementById("account-link");
  if (!link) return;

  try {
    const data = await api("/api/me");
    if (data.user) {
      link.textContent = `Hi, ${data.user.name}`;
      link.href = "#";
      link.addEventListener("click", async (event) => {
        event.preventDefault();
        await api("/api/logout", { method: "POST" });
        window.location.reload();
      });
    }
  } catch {
    // Keep the default login link if session lookup fails.
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  updateAccountLink();

  document.getElementById("login-form")?.addEventListener("submit", handleLogin);
  document.getElementById("register-form")?.addEventListener("submit", handleRegister);

  loadProducts();
  loadCart();
});