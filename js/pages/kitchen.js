// Kitchen page — load active orders and show them as cards.

import { getActiveOrders } from "../api/kitchen.js";

// The area where all order cards go.
const ordersArea = document.querySelector(".orders");

// Module scripts run after the page is ready, so we can start right away.
loadOrders();

// Load the orders and show them.
async function loadOrders() {
  const result = await getActiveOrders();

  // Show a friendly message if something went wrong.
  if (result.error) {
    showMessage("Sorry, we could not load the orders. Please try again.");
    return;
  }

  showOrders(result.data);
}

// Show every order as a card.
function showOrders(orders) {
  ordersArea.innerHTML = "";

  // Nothing to show yet.
  if (!orders || orders.length === 0) {
    showMessage("No active orders");
    return;
  }

  // One card for each order.
  orders.forEach(function (order) {
    ordersArea.appendChild(buildCard(order));
  });
}

// Build a single order card.
function buildCard(order) {
  const card = document.createElement("article");
  card.className = "order-card";

  // Little steam wisps at the top of the card.
  const steam = document.createElement("div");
  steam.className = "steam";
  steam.setAttribute("aria-hidden", "true");
  steam.innerHTML = "<span></span><span></span><span></span>";
  card.appendChild(steam);

  // Head row: type badge and receipt number.
  const head = document.createElement("div");
  head.className = "order-head";

  const badge = document.createElement("span");
  badge.className = "badge";
  if (order.order_type === "dine-in") {
    badge.className = "badge badge-dinein";
  }
  badge.textContent = typeText(order);
  head.appendChild(badge);

  const receipt = document.createElement("span");
  receipt.className = "receipt";
  receipt.textContent = order.receipt_number;
  head.appendChild(receipt);

  card.appendChild(head);

  // For pickup and delivery, show the customer name and pickup time.
  if (order.order_type === "pickup" || order.order_type === "delivery") {
    let text = order.first_name || "";
    if (order.pickup_time) {
      text += (text ? " · " : "") + "Pickup " + order.pickup_time;
    }
    if (text) {
      card.appendChild(makeText("order-note", text));
    }
  }

  // The list of items and their quantity.
  const list = document.createElement("ul");
  list.className = "order-items";
  order.items.forEach(function (item) {
    const li = document.createElement("li");

    const qty = document.createElement("span");
    qty.className = "qty";
    qty.textContent = item.qty + "×";
    li.appendChild(qty);

    li.appendChild(document.createTextNode(item.name));
    list.appendChild(li);
  });
  card.appendChild(list);

  // The note, only when there is one.
  if (order.note) {
    card.appendChild(makeText("order-note", "Note: " + order.note));
  }

  // Foot row: placed time and the action button.
  const foot = document.createElement("div");
  foot.className = "order-foot";

  const placed = document.createElement("span");
  placed.className = "wait-text";
  placed.textContent = "Placed " + formatTime(order.created_at);
  foot.appendChild(placed);

  const button = document.createElement("button");
  button.className = "btn btn-primary";
  button.type = "button";
  button.textContent = "Start preparing";
  foot.appendChild(button);

  card.appendChild(foot);

  return card;
}

// Text for the type badge.
function typeText(order) {
  if (order.order_type === "dine-in") {
    return "Dine-in Table " + order.table_number;
  }
  if (order.order_type === "pickup") {
    return "Pickup";
  }
  if (order.order_type === "delivery") {
    return "Delivery";
  }
  return order.order_type;
}

// Format the placed time like "8:35 PM".
function formatTime(isoText) {
  const date = new Date(isoText);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Make a simple paragraph with a class and some text.
function makeText(className, text) {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}

// Show one message in the orders area.
function showMessage(text) {
  ordersArea.innerHTML = "";
  ordersArea.appendChild(makeText("order-note", text));
}
