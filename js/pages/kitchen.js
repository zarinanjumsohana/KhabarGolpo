
import { getActiveOrders, updateStatus } from "../api/kitchen.js";
const ordersArea = document.querySelector(".orders");
const summaryList = document.querySelector(".summary-list");

let activeOrders = [];
loadOrders();

setInterval(updateWaitTimes, 60000);

async function loadOrders() {
  const result = await getActiveOrders();

  if (result.error) {
    showMessage("Sorry, we could not load the orders. Please try again.");
    return;
  }

  activeOrders = result.data || [];
  showOrders(activeOrders);
}

function showOrders(orders) {
  ordersArea.innerHTML = "";

  updateSummary(orders);
  if (!orders || orders.length === 0) {
    showMessage("No active orders");
    return;
  }
  orders.forEach(function (order) {
    ordersArea.appendChild(buildCard(order));
  });

  updateWaitTimes();
}
function buildCard(order) {
  const card = document.createElement("article");
  card.className = "order-card";
  card.dataset.created = order.created_at;

  const steam = document.createElement("div");
  steam.className = "steam";
  steam.setAttribute("aria-hidden", "true");
  steam.innerHTML = "<span></span><span></span><span></span>";
  card.appendChild(steam);

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

  if (order.order_type === "pickup" || order.order_type === "delivery") {
    let text = order.first_name || "";
    if (order.pickup_time) {
      text += (text ? " · " : "") + "Pickup " + order.pickup_time;
    }
    if (text) {
      card.appendChild(makeText("order-note", text));
    }
  }

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
  if (order.note) {
    card.appendChild(makeText("order-note", "Note: " + order.note));
  }
  const foot = document.createElement("div");
  foot.className = "order-foot";

  const placed = document.createElement("span");
  placed.className = "wait-text";
  placed.textContent = "Waiting " + waitedMinutes(order.created_at) + " min";
  foot.appendChild(placed);

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
async function changeStatus(order, card) {
  const to = nextStatus(order.status);
  if (!to) {
    return;
  }

  const result = await updateStatus(order.id, to);
  if (result.error) {
    showCardError(card, result.error.message);
    return;
  }
  order.status = to;
  showOrders(activeOrders);
}

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
function waitedMinutes(isoText) {
  const start = new Date(isoText).getTime();
  const minutes = Math.floor((Date.now() - start) / 60000);
  if (minutes < 0) {
    return 0;
  }
  return minutes;
}
function updateWaitTimes() {
  const cards = document.querySelectorAll(".order-card");

  cards.forEach(function (card) {
    const minutes = waitedMinutes(card.dataset.created);
    const text = card.querySelector(".wait-text");
    if (text) {
      text.textContent = "Waiting " + minutes + " min";
    }
    if (minutes > 15) {
      card.classList.add("order-late");
    } else {
      card.classList.remove("order-late");
    }
  });
}
function updateSummary(orders) {
  summaryList.innerHTML = "";

  if (!orders || orders.length === 0) {
    return;
  }

  const totals = {};
  orders.forEach(function (order) {
    order.items.forEach(function (item) {
      totals[item.name] = (totals[item.name] || 0) + item.qty;
    });
  });
  const parts = [];
  Object.keys(totals).forEach(function (name) {
    parts.push(name + " x" + totals[name]);
  });

  summaryList.textContent = parts.join(", ");
}

function makeText(className, text) {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}
function showCardError(card, text) {
  let box = card.querySelector(".order-error");
  if (!box) {
    box = makeText("order-error", "");
    card.appendChild(box);
  }
  box.textContent = text;
}

function showMessage(text) {
  ordersArea.innerHTML = "";
  ordersArea.appendChild(makeText("order-note", text));
}
