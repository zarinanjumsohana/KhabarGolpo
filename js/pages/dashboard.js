import { requireRole } from "../utils/guards.js";
import { logout } from "../api/auth.js";
import { listOrders } from "../api/adminOrders.js";
import { formatMoney } from "../utils/format.js";


requireRole(["admin"]);

wireLogout();
loadStats();


function wireLogout() {
  const button = document.querySelector("#logout-button");
  button.addEventListener("click", async function (event) {
    event.preventDefault();
    await logout();
    window.location.href = "/admin/login.html";
  });
}

async function loadStats() {
  const result = await listOrders();

  if (result.error) {
    showMessage("Sorry, we could not load the dashboard. Please try again.");
    return;
  }

  
  const data = result.data || {};
  const rows = Array.isArray(data) ? data : (data.rows || []);

  fillCards(rows);
}


function fillCards(rows) {
  let pending = 0;
  let sales = 0;

  rows.forEach(function (order) {
    if (order.status === "new" || order.status === "preparing" || order.status === "ready") {
      pending += 1;
    }
    if (order.payment_status === "paid" && order.status !== "cancelled") {
      sales += Number(order.total) || 0;
    }
  });

  setText("#stat-orders", rows.length);
  setText("#stat-pending", pending);
  setText("#stat-sales", "৳" + formatMoney(sales));
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
}

// Show a friendly message when something goes wrong.
function showMessage(text) {
  const message = document.querySelector("#dash-message");
  message.textContent = text;
  message.hidden = false;
}
