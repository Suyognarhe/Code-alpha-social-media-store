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
  const element = document.getElementById("cart-count");
  if (!element) return;

  element.textContent = getCart().reduce((sum, item) => sum + item.quantity, 0);
}

function formatPrice(price) {
  return `$${Number(price).toFixed(2)}`;
}

async function loadProduct() {
  const id = new URLSearchParams(window.location.search).get("id");
  const container = document.getElementById("product-details");
  const message = document.getElementById("message");

  if (!id) {
    message.textContent = "No product was selected.";
    return;
  }

  try {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`);
    const product = await response.json();

    if (!response.ok) throw new Error(product.error || "Product not found.");

    container.innerHTML = `
      <div class="detail-layout">
        <img src="${product.image}" alt="${product.name}">
        <div>
          <p class="eyebrow">Simple Store collection</p>
          <h1>${product.name}</h1>
          <p class="price">${formatPrice(product.price)}</p>
          <p>${product.description}</p>
          <button type="button" id="add-to-cart">Add to cart</button>
        </div>
      </div>
    `;

    document.getElementById("add-to-cart").addEventListener("click", () => {
      const cart = getCart();
      const existingItem = cart.find((item) => item.productId === product.id);

      if (existingItem) existingItem.quantity += 1;
      else cart.push({ productId: product.id, quantity: 1 });

      saveCart(cart);
      message.textContent = "Added to cart.";
    });
  } catch (error) {
    message.textContent = error.message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  loadProduct();
});