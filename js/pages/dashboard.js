
import { getSession, logout } from "../api/auth.js";
import { MOCK_MODE } from "../config.js"; 
import { listOrders, getOrder } from "../api/adminOrders.js";

// ---- Small settings ----
const PER_PAGE = 100; 
const MAX_PAGES = 5;
const MAX_DETAIL_FETCH = 50; 
const RECENT_COUNT = 6; 
const TOP_COUNT = 5; 

// Orders that still need work (used for "Pending orders")
const ACTIVE_STATUSES = ["new", "preparing", "ready"];

// ---- Tiny helpers ----

function formatNumber(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Money as elements so the Taka sign can use its own font (never innerHTML)
function moneyNode(value) {
  const wrap = make("span", "money");
  wrap.appendChild(make("span", "money-sym", "৳"));
  wrap.appendChild(make("span", "money-num", formatNumber(value)));
  return wrap;
}

// Short clock time like "6:30 PM"
function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Is this date on today's local date?
function isToday(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

// Is this date on yesterday's local date?
function isYesterday(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.getFullYear() === y.getFullYear()
    && d.getMonth() === y.getMonth()
    && d.getDate() === y.getDate();
}

// Is this date inside the current week (Monday to Sunday)?
function isThisWeek(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return false;
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return d >= monday && d < nextMonday;
}

// "pickup" -> "Pickup"
function capitalize(text) {
  const s = String(text || "");
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Make an element with a class and some text (never innerHTML)
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Make an SVG element with attributes (never innerHTML)
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
  }
  return node;
}

// Local date key "YYYY-MM-DD" so we can group orders by day
function dayKey(date) {
  if (!(date instanceof Date) || isNaN(date)) return "";
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + m + "-" + d;
}

// ISO string -> local date key
function isoDayKey(iso) {
  return dayKey(new Date(iso));
}

// ---- Motion helpers ----
// True when the user asked for less motion.
function prefersReducedMotion() {
  return window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Count a number up from 0 to toValue in about 0.8s.
function countUp(element, toValue, format) {
  if (!element) return;

  if (prefersReducedMotion()) {
    element.textContent = format(toValue);
    return;
  }

  const duration = 800;
  const startTime = performance.now();

  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out
    element.textContent = format(toValue * eased);
    if (t < 1) requestAnimationFrame(step);
    else element.textContent = format(toValue);
  }

  requestAnimationFrame(step);
}


async function ensureAdmin() {
  // While mocking, skip the redirect so the page can be tested.
  if (MOCK_MODE) return true;

  const { data, error } = await getSession();
  const ok = !error && data && data.role === "admin";
  if (!ok) {
    window.location.href = "/admin/login.html";
    return false;
  }
  return true;
}

// listOrders may return data as an array (mock) or as { rows, total_count }.
function readOrderPage(res) {
  const d = res && res.data;
  const rows = Array.isArray(d) ? d : (d && Array.isArray(d.rows) ? d.rows : []);

  let total = null;
  if (d && typeof d.total_count === "number") total = d.total_count;
  else if (res && typeof res.total_count === "number") total = res.total_count;

  return { rows, total };
}

// Load every order, page by page, up to MAX_PAGES pages.
async function loadAllOrders() {
  const all = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const res = await listOrders({ page: page, per_page: PER_PAGE });
    if (res && res.error) throw res.error;

    const pageData = readOrderPage(res);
    all.push.apply(all, pageData.rows);

    if (pageData.rows.length < PER_PAGE) break; // last page reached
    if (pageData.total != null && all.length >= pageData.total) break; // got them all
    page = page + 1;
  }

  return all;
}

// ---- Rendering ----
function setText(selector, text) {
  const node = document.querySelector(selector);
  if (node) node.textContent = text;
}

// Greeting by time of day + "story of the day" line
function renderGreeting(todayCount) {
  const hour = new Date().getHours();
  let part = "evening";
  if (hour < 12) part = "morning";
  else if (hour < 17) part = "afternoon";

  setText(".greet-title", "Good " + part + ", Admin");

  const word = todayCount === 1 ? "story" : "stories";
  setText(".greet-sub", todayCount + " " + word + " told today");
}

// Percent change between two numbers, or null when there is no base to
// compare against (i.e. no orders yesterday).
function percentChange(today, yesterday) {
  if (!yesterday) return null;
  return ((today - yesterday) / yesterday) * 100;
}

// Write a "vs yesterday" delta line. pct === null means no orders yesterday.
function setDelta(selector, pct) {
  const el = document.querySelector(selector);
  if (!el) return;

  if (pct === null) {
    el.className = "kpi-delta flat";
    el.textContent = "No orders yesterday";
    return;
  }

  const rounded = Math.round(pct);
  const dir = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  el.className = "kpi-delta " + dir;
  el.textContent = (rounded > 0 ? "+" : "") + rounded + "% vs yesterday";
}

// Put a money value (with its own Taka element) into a card and count it up.
function setMoneyValue(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.replaceChildren();
  const node = moneyNode(value);
  el.appendChild(node);
  countUp(node.querySelector(".money-num"), value, formatNumber);
}

// Four KPI cards
function renderKpis(orders) {
  const today = orders.filter(function (o) { return isToday(o.created_at); });
  const yesterday = orders.filter(function (o) { return isYesterday(o.created_at); });

  // Order value today = every non-cancelled order of today
  const activeToday = today.filter(function (o) { return o.status !== "cancelled"; });
  const activeYesterday = yesterday.filter(function (o) { return o.status !== "cancelled"; });

  const valueToday = activeToday.reduce(function (sum, o) {
    return sum + (Number(o.total) || 0);
  }, 0);
  const valueYesterday = activeYesterday.reduce(function (sum, o) {
    return sum + (Number(o.total) || 0);
  }, 0);

  const averageToday = activeToday.length ? valueToday / activeToday.length : 0;
  const averageYesterday = activeYesterday.length ? valueYesterday / activeYesterday.length : 0;

  const pending = orders.filter(function (o) {
    return ACTIVE_STATUSES.indexOf(o.status) !== -1;
  });

  // Paid sales = paid and not cancelled, today only
  const paidToday = activeToday.filter(function (o) {
    return o.payment_status === "paid";
  });
  const paidSales = paidToday.reduce(function (sum, o) {
    return sum + (Number(o.total) || 0);
  }, 0);

  // Card 1: today's orders + change in order count vs yesterday
  countUp(document.querySelector(".kpi-lime .kpi-value"), today.length, function (v) {
    return String(Math.round(v));
  });
  setDelta(".kpi-lime .kpi-delta", percentChange(today.length, yesterday.length));

  // Card 2: pending orders
  countUp(document.querySelector(".kpi-saffron .kpi-value"), pending.length, function (v) {
    return String(Math.round(v));
  });
  const pendingDelta = document.querySelector(".kpi-saffron .kpi-delta");
  if (pendingDelta) {
    pendingDelta.className = "kpi-delta " + (pending.length ? "warn" : "up");
    pendingDelta.textContent = pending.length ? "Needs attention" : "All clear";
  }

  // Card 3: paid sales + how many of today's orders are paid
  setText(".kpi-coral .kpi-label", "Paid sales");
  setMoneyValue(".kpi-coral .kpi-value", paidSales);
  const paidDelta = document.querySelector(".kpi-coral .kpi-delta");
  if (paidDelta) {
    paidDelta.className = "kpi-delta flat";
    paidDelta.textContent = paidToday.length + " of " + activeToday.length + " orders paid";
  }

  // Card 4: average order + its change vs yesterday
  setMoneyValue(".kpi-violet .kpi-value", averageToday);
  setDelta(".kpi-violet .kpi-delta", percentChange(averageToday, averageYesterday));

  return { todayCount: today.length };
}

// Status chip text and colour class
function statusInfo(status) {
  const map = {
    "new": { label: "New", cls: "status-new" },
    "preparing": { label: "Preparing", cls: "status-preparing" },
    "ready": { label: "Ready", cls: "status-ready" },
    "out_for_delivery": { label: "On the way", cls: "status-ready" },
    "completed": { label: "Completed", cls: "status-completed" },
    "cancelled": { label: "Cancelled", cls: "status-cancelled" }
  };
  return map[status] || { label: capitalize(status || "Unknown"), cls: "status-completed" };
}

// Type chip text, e.g. "Dine-in · T5"
function typeText(order) {
  const labels = { "dine-in": "Dine-in", "pickup": "Pickup", "delivery": "Delivery" };
  const base = labels[order.order_type] || capitalize(order.order_type || "Order");
  if (order.order_type === "dine-in" && order.table_number != null) {
    return base + " · T" + order.table_number;
  }
  return base;
}

// Recent orders list (latest 6)
function renderRecentOrders(orders) {
  const list = document.querySelector(".row-list");
  if (!list) return;
  list.replaceChildren();

  const latest = orders
    .slice()
    .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); })
    .slice(0, RECENT_COUNT);

  if (!latest.length) {
    const li = make("li", "row");
    li.appendChild(make("span", "row-sub", "No orders yet."));
    list.appendChild(li);
    return;
  }

  latest.forEach(function (order) {
    const row = make("li", "row");
    row.appendChild(make("span", "receipt", order.receipt_number || "—"));
    row.appendChild(make("span", "type-chip", typeText(order)));

    const totalNode = moneyNode(order.total);
    totalNode.classList.add("row-total");
    row.appendChild(totalNode);

    const info = statusInfo(order.status);
    row.appendChild(make("span", "status " + info.cls, info.label));

    list.appendChild(row);
  });
}

// Item name/quantity, handling both possible field names
function lineName(line) {
  return line.item_name || line.name || "Item";
}
function lineQty(line) {
  return Number(line.quantity != null ? line.quantity : line.qty) || 0;
}

// Work out the top items by total quantity sold this week
async function loadTopItems(orders) {
  // This week's non-cancelled orders only
  const chosen = orders
    .filter(function (o) {
      return isThisWeek(o.created_at) && o.status !== "cancelled";
    })
    .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); })
    .slice(0, MAX_DETAIL_FETCH);

  const results = await Promise.all(
    chosen.map(function (o) {
      return getOrder(o.id).then(function (r) { return r; }).catch(function () { return null; });
    })
  );

  const counts = new Map();
  results.forEach(function (res) {
    if (!res || res.error || !res.data) return;
    const lines = res.data.items || res.data.lines || [];
    lines.forEach(function (line) {
      const name = lineName(line);
      counts.set(name, (counts.get(name) || 0) + lineQty(line));
    });
  });

  return Array.from(counts.entries())
    .map(function (pair) { return { name: pair[0], qty: pair[1] }; })
    .sort(function (a, b) { return b.qty - a.qty; })
    .slice(0, TOP_COUNT);
}

// Top items list with progress bars
function renderTopItems(top) {
  const list = document.querySelector(".item-list");
  if (!list) return;
  list.replaceChildren();

  if (!top.length) {
    const empty = make("li", "item");
    empty.appendChild(make("span", "row-sub", "No items sold yet."));
    list.appendChild(empty);
    return;
  }

  const colors = ["fill-lime", "fill-saffron", "fill-coral", "fill-violet"];
  const max = top[0].qty || 1;

  top.forEach(function (entry, index) {
    const li = make("li", "item");

    const head = make("div", "item-top");
    head.appendChild(make("span", "item-name", entry.name));
    head.appendChild(make("span", "item-pct", entry.qty + " sold"));
    li.appendChild(head);

    const track = make("div", "track");
    const fill = make("span", "fill " + colors[index % colors.length]);
    fill.style.width = Math.round((entry.qty / max) * 100) + "%";
    track.appendChild(fill);
    li.appendChild(track);

    list.appendChild(li);
  });
}

// Weekly bar chart (Mon-Sun), today highlighted in lime
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function renderWeeklyChart(orders) {
  const bars = document.querySelector(".bars");
  if (!bars) return;
  bars.replaceChildren();

  // Monday of this week
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const todayKey = dayKey(now);

  // Count orders per day
  const countsByDay = {};
  orders.forEach(function (o) {
    const key = isoDayKey(o.created_at);
    countsByDay[key] = (countsByDay[key] || 0) + 1;
  });

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const key = dayKey(date);
    days.push({ label: WEEK_DAYS[i], key: key, count: countsByDay[key] || 0 });
  }

  const max = days.reduce(function (m, d) { return Math.max(m, d.count); }, 0);

  days.forEach(function (day, index) {
    const isToday = day.key === todayKey;
    const wrap = make("div", "bar-wrap" + (isToday ? " is-today" : ""));
    wrap.appendChild(make("span", "bar-count", String(day.count)));

    const bar = make("span", "bar" + (isToday ? " is-today" : ""));
    bar.style.height = (max ? Math.round((day.count / max) * 100) : 0) + "%";
    bar.style.animationDelay = (index * 40) + "ms";
    wrap.appendChild(bar);

    wrap.appendChild(make("span", "bar-day", day.label));
    bars.appendChild(wrap);
  });
}

// Status donut colours (fixed order)
const STATUS_CHART = [
  { key: "new", label: "New", color: "var(--saffron)" },
  { key: "preparing", label: "Preparing", color: "var(--violet)" },
  { key: "ready", label: "Ready", color: "var(--lime)" },
  { key: "out_for_delivery", label: "On the way", color: "var(--sky)" },
  { key: "completed", label: "Completed", color: "var(--muted)" },
  { key: "cancelled", label: "Cancelled", color: "var(--coral)" }
];

function renderStatusDonut(orders) {
  const box = document.querySelector(".donut-box");
  if (!box) return;
  box.replaceChildren();

  // Count orders per status
  const counts = {};
  orders.forEach(function (o) {
    const key = o.status || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  });

  const total = orders.length;
  const R = 46;
  const C = 2 * Math.PI * R;

  const svg = svgEl("svg", {
    "class": "donut",
    viewBox: "0 0 120 120",
    role: "img",
    "aria-label": "Orders by status"
  });

  // Grey background ring
  svg.appendChild(svgEl("circle", {
    "class": "donut-track",
    cx: 60, cy: 60, r: R,
    fill: "none",
    "stroke-width": 14
  }));

  // One segment per status that has orders
  let offset = 0;
  let shown = 0;
  const segCircles = [];
  STATUS_CHART.forEach(function (status) {
    const count = counts[status.key] || 0;
    if (!count) return;
    shown = shown + 1;

    const len = (count / total) * C;
    const angle = (offset / C) * 360;

    // dasharray "len C" keeps one dash only, so dashoffset len->0 draws it.
    const circle = svgEl("circle", {
      "class": "donut-seg",
      cx: 60, cy: 60, r: R,
      fill: "none",
      stroke: status.color,
      "stroke-width": 14,
      "stroke-linecap": "butt",
      "stroke-dasharray": len + " " + C,
      "stroke-dashoffset": len,
      transform: "rotate(" + (angle - 90) + " 60 60)"
    });
    circle.style.strokeDashoffset = len + "px";
    svg.appendChild(circle);
    segCircles.push(circle);

    offset = offset + len;
  });

  // Total in the middle
  const totalText = svgEl("text", {
    "class": "donut-total",
    x: 60, y: 58,
    "text-anchor": "middle",
    "dominant-baseline": "middle"
  });
  svg.appendChild(totalText);

  const labelText = svgEl("text", {
    "class": "donut-total-label",
    x: 60, y: 76,
    "text-anchor": "middle",
    "dominant-baseline": "middle"
  });
  labelText.textContent = "orders";
  svg.appendChild(labelText);

  box.appendChild(svg);

  // Count the total in the middle + draw the ring
  countUp(totalText, total, function (v) { return String(Math.round(v)); });

  if (prefersReducedMotion()) {
    segCircles.forEach(function (circle) {
      circle.style.strokeDashoffset = "0px";
    });
  } else {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        segCircles.forEach(function (circle, index) {
          circle.style.transitionDelay = (index * 90) + "ms";
          circle.style.strokeDashoffset = "0px";
        });
      });
    });
  }

  // Legend with counts
  const legend = make("ul", "legend");
  if (!shown) {
    legend.appendChild(make("li", null, "No orders yet"));
  } else {
    STATUS_CHART.forEach(function (status) {
      const count = counts[status.key] || 0;
      if (!count) return;
      const li = make("li");
      const dot = make("span", "dot");
      dot.style.background = status.color;
      li.appendChild(dot);
      li.appendChild(make("span", null, status.label));
      li.appendChild(make("span", "legend-count", String(count)));
      legend.appendChild(li);
    });
  }
  box.appendChild(legend);
}

// ---- Flow panel: channel chips + curved connectors + sales ring ----
const CHANNELS = [
  { key: "dine-in", label: "Dine-in", color: "var(--lime)" },
  { key: "pickup", label: "Pickup", color: "var(--saffron)" },
  { key: "delivery", label: "Delivery", color: "var(--violet)" }
];

function renderFlowPanel(orders) {
  const channelsBox = document.querySelector(".flow-channels");
  const ringWrap = document.querySelector(".flow-ring-wrap");
  const sub = document.querySelector(".flow-sub");
  if (!channelsBox || !ringWrap) return;

  setText(".flow-title", "Order value today");

  // Order value today = every non-cancelled order of today
  const today = orders.filter(function (o) {
    return isToday(o.created_at) && o.status !== "cancelled";
  });

  const groups = CHANNELS.map(function (c) {
    return { key: c.key, label: c.label, color: c.color, count: 0, amount: 0 };
  });
  const byKey = {};
  groups.forEach(function (g) { byKey[g.key] = g; });

  let total = 0;
  today.forEach(function (o) {
    const amount = Number(o.total) || 0;
    total = total + amount;
    const group = byKey[o.order_type];
    if (group) {
      group.count = group.count + 1;
      group.amount = group.amount + amount;
    }
  });

  // Compare order value today with yesterday (shown under the title)
  const valueYesterday = orders
    .filter(function (o) { return isYesterday(o.created_at) && o.status !== "cancelled"; })
    .reduce(function (sum, o) { return sum + (Number(o.total) || 0); }, 0);

  if (sub) {
    const pct = percentChange(total, valueYesterday);
    if (pct === null) {
      sub.className = "flow-sub";
      sub.textContent = "No orders yesterday";
    } else {
      const rounded = Math.round(pct);
      sub.className = "flow-sub " + (rounded > 0 ? "up" : rounded < 0 ? "down" : "");
      sub.textContent = (rounded > 0 ? "+" : "") + rounded + "% vs yesterday";
    }
  }

  // Channel chips
  channelsBox.replaceChildren();
  groups.forEach(function (g) {
    const chip = make("div", "channel");
    chip.style.setProperty("--c", g.color);
    chip.appendChild(make("span", "channel-dot"));

    const info = make("div", "channel-info");
    info.appendChild(make("span", "channel-label", g.label));
    info.appendChild(make("span", "channel-count",
      g.count + (g.count === 1 ? " order" : " orders")));
    chip.appendChild(info);

    const amount = moneyNode(g.amount);
    amount.classList.add("channel-amount");
    chip.appendChild(amount);
    channelsBox.appendChild(chip);
  });

  // Sales ring: one arc per channel, sized by its share of today's value
  ringWrap.replaceChildren();

  const size = 190;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;

  const svg = svgEl("svg", {
    "class": "flow-ring",
    viewBox: "0 0 " + size + " " + size,
    role: "img",
    "aria-label": "Order value today by channel"
  });

  // Faint grey base ring (also the whole ring when there are no orders)
  svg.appendChild(svgEl("circle", {
    "class": "flow-ring-track",
    cx: size / 2, cy: size / 2, r: r,
    fill: "none"
  }));

  const arcs = [];
  if (total > 0) {
    const gap = 8; // small gap between arcs, measured along the ring
    const gapDeg = (gap / C) * 360;
    let acc = 0;

    groups.forEach(function (g) {
      if (g.amount <= 0) return;
      const share = g.amount / total;
      const raw = share * C;
      const len = Math.max(raw - gap, 2);
      const startDeg = (acc / C) * 360 + gapDeg / 2;

      const arc = svgEl("circle", {
        "class": "flow-arc",
        cx: size / 2, cy: size / 2, r: r,
        fill: "none",
        "stroke-width": stroke,
        "stroke-linecap": "butt",
        "stroke-dasharray": len + " " + (C - len),
        "stroke-dashoffset": len,
        transform: "rotate(" + startDeg + " " + (size / 2) + " " + (size / 2) + ")"
      });
      arc.style.setProperty("--c", g.color);
      arc.style.strokeDashoffset = len + "px";
      svg.appendChild(arc);
      arcs.push(arc);

      acc = acc + raw;
    });
  }

  ringWrap.appendChild(svg);

  const center = make("div", "flow-ring-center");
  const totalEl = make("p", "flow-ring-total");
  const totalNode = moneyNode(total);
  totalEl.appendChild(totalNode);
  center.appendChild(totalEl);
  center.appendChild(make("p", "flow-ring-label", "Order value today"));
  center.appendChild(make("p", "flow-ring-sub",
    today.length + (today.length === 1 ? " order" : " orders")));
  ringWrap.appendChild(center);

  countUp(totalNode.querySelector(".money-num"), total, formatNumber);

  // Draw the arcs in
  if (prefersReducedMotion()) {
    arcs.forEach(function (arc) { arc.style.strokeDashoffset = "0px"; });
  } else {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        arcs.forEach(function (arc, index) {
          arc.style.transitionDelay = (index * 90) + "ms";
          arc.style.strokeDashoffset = "0px";
        });
      });
    });
  }
}

// Draw the curved connectors from each chip to the sales ring.
function drawFlowLines() {
  const svg = document.querySelector(".flow-lines");
  const body = document.querySelector(".flow-body");
  const ringWrap = document.querySelector(".flow-ring-wrap");
  const channelsBox = document.querySelector(".flow-channels");
  if (!svg || !body || !ringWrap || !channelsBox) return;

  svg.replaceChildren();

  const chips = Array.prototype.slice.call(channelsBox.querySelectorAll(".channel"));
  const bodyRect = body.getBoundingClientRect();
  if (!chips.length || !bodyRect.width || !bodyRect.height) return;

  svg.setAttribute("viewBox",
    "0 0 " + Math.round(bodyRect.width) + " " + Math.round(bodyRect.height));
  svg.setAttribute("preserveAspectRatio", "none");

  const ringRect = ringWrap.getBoundingClientRect();
  const endX = ringRect.left - bodyRect.left + ringRect.width * 0.06;
  const endY = ringRect.top - bodyRect.top + ringRect.height / 2;

  chips.forEach(function (chip, index) {
    const c = chip.getBoundingClientRect();
    const startX = c.right - bodyRect.left;
    const startY = c.top - bodyRect.top + c.height / 2;
    const midX = (startX + endX) / 2;

    const d = "M " + startX + " " + startY +
              " C " + midX + " " + startY +
              ", " + midX + " " + endY +
              ", " + endX + " " + endY;

    const color = chip.style.getPropertyValue("--c") || "var(--lime)";

    const glow = svgEl("path", { "class": "flow-glow", d: d });
    glow.style.setProperty("--c", color);
    svg.appendChild(glow);

    const curve = svgEl("path", { "class": "flow-curve", d: d });
    curve.style.setProperty("--c", color);
    svg.appendChild(curve);

    const pulse = svgEl("path", { "class": "flow-pulse", d: d });
    pulse.style.setProperty("--c", color);
    const len = pulse.getTotalLength();
    pulse.style.setProperty("--len", len);
    pulse.style.setProperty("--pulse", Math.max(18, len * 0.18));
    pulse.style.animationDelay = (index * 0.5).toFixed(2) + "s";
    svg.appendChild(pulse);
  });
}

// Redraw connectors when the window is resized (debounced).
let flowRedrawTimer = null;
function scheduleFlowRedraw() {
  if (flowRedrawTimer) clearTimeout(flowRedrawTimer);
  flowRedrawTimer = setTimeout(drawFlowLines, 150);
}
window.addEventListener("resize", scheduleFlowRedraw);

// Friendly message when something goes wrong
function showError() {
  setText(".greet-sub", "Here is today's story");
  setText(".kpi-lime .kpi-value", "—");
  setText(".kpi-saffron .kpi-value", "—");
  setText(".kpi-coral .kpi-value", "—");
  setText(".kpi-violet .kpi-value", "—");
  setText(".flow-sub", "We couldn't load your dashboard right now. Please refresh in a moment.");

  const flowChannels = document.querySelector(".flow-channels");
  if (flowChannels) flowChannels.replaceChildren();

  const flowRing = document.querySelector(".flow-ring-wrap");
  if (flowRing) flowRing.replaceChildren();

  const bars = document.querySelector(".bars");
  if (bars) {
    bars.replaceChildren();
    bars.appendChild(make("span", "row-sub", "Chart unavailable."));
  }

  const donutBox = document.querySelector(".donut-box");
  if (donutBox) {
    donutBox.replaceChildren();
    donutBox.appendChild(make("span", "row-sub", "Chart unavailable."));
  }

  const rows = document.querySelector(".row-list");
  if (rows) {
    rows.replaceChildren();
    const li = make("li", "row");
    li.appendChild(make("span", "row-sub", "Could not load orders."));
    rows.appendChild(li);
  }

  const items = document.querySelector(".item-list");
  if (items) {
    items.replaceChildren();
    const li = make("li", "item");
    li.appendChild(make("span", "row-sub", "Could not load items."));
    items.appendChild(li);
  }
}

// Logout link
function setupLogout() {
  const link = document.querySelector(".nav-link.logout");
  if (!link) return;
  link.addEventListener("click", async function (event) {
    event.preventDefault();
    const { error } = await logout();
    if (!error) window.location.href = "/admin/login.html";
  });
}

// Sections fade and rise in, one after another (stagger 60ms)
function revealSections() {
  if (prefersReducedMotion()) return; // leave everything visible

  const sections = document.querySelectorAll(".topbar, .flow, .kpi-row, .two-col");
  sections.forEach(function (section, index) {
    section.classList.add("reveal-in");
    section.style.animationDelay = (index * 60) + "ms";
  });
}

// Gentle tilt + mouse glow on cards (desktop only)
function setupTilt() {
  if (prefersReducedMotion()) return;

  // Only for devices with a real mouse/hover
  const canHover = window.matchMedia
    && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!canHover) return;

  const cards = document.querySelectorAll(".card, .flow");
  const maxTilt = 6;

  cards.forEach(function (card) {
    card.addEventListener("mousemove", function (event) {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width; // 0..1
      const py = (event.clientY - rect.top) / rect.height; // 0..1

      const tiltX = (0.5 - py) * maxTilt;
      const tiltY = (px - 0.5) * maxTilt;

      card.style.transform =
        "perspective(800px) rotateX(" + tiltX.toFixed(2) + "deg) " +
        "rotateY(" + tiltY.toFixed(2) + "deg) translateY(-4px)";

      card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      card.classList.add("is-lit");
    });

    card.addEventListener("mouseleave", function () {
      card.style.transform = "";
      card.classList.remove("is-lit");
    });
  });
}

// ---- Start the page ----
async function init() {
  setupLogout();

  const allowed = await ensureAdmin();
  if (!allowed) return;

  revealSections();
  setupTilt();

  try {
    const orders = await loadAllOrders();
    const info = renderKpis(orders);
    renderGreeting(info.todayCount);
    renderFlowPanel(orders);
    renderWeeklyChart(orders);
    renderStatusDonut(orders);
    renderRecentOrders(orders);

    requestAnimationFrame(drawFlowLines);

    const top = await loadTopItems(orders);
    renderTopItems(top);
  } catch (err) {
    showError();
  }
}

init();
