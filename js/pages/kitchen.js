// Kitchen page — load active orders and move them along the chef flow.

import { getActiveOrders, updateStatus } from "../api/kitchen.js";

// The area where all order cards go.
const ordersArea = document.querySelector(".orders");

// The summary bar that lists all items to prepare.
const summaryList = document.querySelector(".summary-list");

// The orders we are currently showing (kept in memory).
let activeOrders = [];

// Module scripts run after the page is ready, so we can start right away.
loadOrders();

// Refresh the waiting times every minute (no page reload).
setInterval(updateWaitTimes, 60000);

// Load the orders and show them.
async function loadOrders() {
  const result = await getActiveOrders();

  // Show a friendly message if something went wrong.
  if (result.error) {
    showMessage("Sorry, we could not load the orders. Please try again.");
    return;
  }

  activeOrders = result.data || [];
  showOrders(activeOrders);
}

// Show every order as a card.
function showOrders(orders) {
  ordersArea.innerHTML = "";

  // Refresh the "Items to prepare" bar for the new list.
  updateSummary(orders);

  // Nothing to show yet.
  if (!orders || orders.length === 0) {
    showMessage("No active orders");
    return;
  }

  // One card for each order.
  orders.forEach(function (order) {
    ordersArea.appendChild(buildCard(order));
  });

  // Set the waiting times right away.
  updateWaitTimes();
}

// Build a single order card.
function buildCard(order) {
  const card = document.createElement("article");
  card.className = "order-card";

  // Remember when the order was placed, so we can update the waiting time.
  card.dataset.created = order.created_at;

  // Little steam wisps at the top of the card.
  const steam = document.createElement("div");
  steam.className = "steam";
  steam.setAttribute("aria-hidden", "true");
  steam.innerHTML = "<span></span><span></span><span></span>";
  card.appendChild(steam);

  // Head row: type badge on the left, status badge and receipt on the right.
  const head = document.createElement("div");
  head.className = "order-head";

  const typeBadge = document.createElement("span");
  typeBadge.className = "badge";
  if (order.order_type === "dine-in") {
    typeBadge.className = "badge badge-dinein";
  }
  typeBadge.textContent = typeText(order);
  head.appendChild(typeBadge);

  const right = document.createElement("div");
  right.className = "order-head-right";

  // Status badge, colored by the current status.
  const statusBadge = document.createElement("span");
  statusBadge.className = "badge status-" + order.status;
  statusBadge.textContent = order.status;
  right.appendChild(statusBadge);

  const receipt = document.createElement("span");
  receipt.className = "receipt";
  receipt.textContent = order.receipt_number;
  right.appendChild(receipt);

  head.appendChild(right);
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

  // Foot row: waiting time and the status button.
  const foot = document.createElement("div");
  foot.className = "order-foot";

  const placed = document.createElement("span");
  placed.className = "wait-text";
  placed.textContent = "Waiting " + waitedMinutes(order.created_at) + " min";
  foot.appendChild(placed);

  // Only add a button when there is a next step.
  if (nextStatus(order.status)) {
    const button = document.createElement("button");
    button.className = "btn btn-primary";
    button.type = "button";
    button.textContent = buttonText(order.status);
    button.addEventListener("click", function () {
      changeStatus(order, card);
    });
    foot.appendChild(button);
  }

  card.appendChild(foot);

  return card;
}

// Move an order to its next status.
async function changeStatus(order, card) {
  const to = nextStatus(order.status);
  if (!to) {
    return;
  }

  const result = await updateStatus(order.id, to);

  // If there is an error, show it on this card.
  if (result.error) {
    showCardError(card, result.error.message);
    return;
  }

  // The mock does not save, so update our own list and show the cards again.
  order.status = to;
  showOrders(activeOrders);
}

// Which status comes next for the chef.
function nextStatus(status) {
  if (status === "new") {
    return "preparing";
  }
  if (status === "preparing") {
    return "ready";
  }
  if (status === "ready") {
    return "preparing";
  }
  return null;
}

// The button text for the current status.
function buttonText(status) {
  if (status === "new") {
    return "Start preparing";
  }
  if (status === "preparing") {
    return "Mark ready";
  }
  if (status === "ready") {
    return "Back to preparing";
  }
  return "";
}

// Text for the order type badge.
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

// How many minutes have passed since the order was placed.
function waitedMinutes(isoText) {
  const start = new Date(isoText).getTime();
  const minutes = Math.floor((Date.now() - start) / 60000);
  if (minutes < 0) {
    return 0;
  }
  return minutes;
}

// Update the waiting time on each card, without rebuilding the cards.
function updateWaitTimes() {
  const cards = document.querySelectorAll(".order-card");

  cards.forEach(function (card) {
    const minutes = waitedMinutes(card.dataset.created);

    // Update the waiting time text.
    const text = card.querySelector(".wait-text");
    if (text) {
      text.textContent = "Waiting " + minutes + " min";
    }

    // Highlight the card if it has waited too long.
    if (minutes > 15) {
      card.classList.add("order-late");
    } else {
      card.classList.remove("order-late");
    }
  });
}

// Fill the summary bar with the total quantity of each item.
function updateSummary(orders) {
  summaryList.innerHTML = "";

  if (!orders || orders.length === 0) {
    return;
  }

  // Add up the quantity of every item name.
  const totals = {};
  orders.forEach(function (order) {
    order.items.forEach(function (item) {
      totals[item.name] = (totals[item.name] || 0) + item.qty;
    });
  });

  // Build a text like "Burger x7, Fries x12".
  const parts = [];
  Object.keys(totals).forEach(function (name) {
    parts.push(name + " x" + totals[name]);
  });

  summaryList.textContent = parts.join(", ");
}

// Make a simple paragraph with a class and some text.
function makeText(className, text) {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}

// Show an error message on one card.
function showCardError(card, text) {
  let box = card.querySelector(".order-error");
  if (!box) {
    box = makeText("order-error", "");
    card.appendChild(box);
  }
  box.textContent = text;
}

// Show one message in the orders area.
function showMessage(text) {
  ordersArea.innerHTML = "";
  ordersArea.appendChild(makeText("order-note", text));
}
