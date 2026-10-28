(function () {
  'use strict';

  var THEME_KEY = 'kg.kitchen.theme';
  var ALERT_KEY = 'kg.kitchen.alertMinutes';
  var DEFAULT_ALERT = 15;
  var MIN_ALERT = 1;
  var MAX_ALERT = 120;
  var root = document.documentElement;

  function getTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    var t = theme === 'dark' ? 'dark' : 'light';
    root.setAttribute('data-theme', t);
    root.style.colorScheme = t;

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0b0f16' : '#f2f3f2');

    var btn = document.querySelector('[data-theme-toggle]');
    if (btn) {
      btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    return t;
  }

  function setTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      /* theme still applies for this session */
    }
    return applyTheme(theme);
  }

  var themeToggle = document.querySelector('[data-theme-toggle]');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
  }
  applyTheme(getTheme());

  var sidebar = document.getElementById('kitchenSidebar');
  var sidebarToggle = document.querySelector('[data-sidebar-toggle]');
  if (sidebar && sidebarToggle) {
    var setSidebarCollapsed = function (collapsed) {
      document.body.classList.toggle('is-sidebar-collapsed', collapsed);
      sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
      sidebarToggle.setAttribute('aria-label', collapsed ? 'Show sidebar' : 'Hide sidebar');
      sidebar.inert = collapsed;
    };

    sidebarToggle.addEventListener('click', function () {
      setSidebarCollapsed(!document.body.classList.contains('is-sidebar-collapsed'));
    });
  }

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* private mode: keeps working for this session */
    }
  }

  function readAlertMinutes() {
    var value = parseInt(readStorage(ALERT_KEY), 10);
    if (!isFinite(value)) return DEFAULT_ALERT;
    return Math.min(MAX_ALERT, Math.max(MIN_ALERT, value));
  }

  var alertMinutes = readAlertMinutes();

  /* ------------------------------ page switch ------------------------------ */

  var pages = Array.prototype.slice.call(document.querySelectorAll('[data-page]'));
  var pageLinks = pages.length ? Array.prototype.slice.call(document.querySelectorAll('[data-page-link]')) : [];
  var live = document.querySelector('[data-live]');

  function showPage(name) {
    var found = false;

    for (var p = 0; p < pages.length; p += 1) {
      var pageOn = pages[p].getAttribute('data-page') === name;
      pages[p].hidden = !pageOn;
      if (pageOn) found = true;
    }
    if (!found) return;

    for (var l = 0; l < pageLinks.length; l += 1) {
      var linkOn = pageLinks[l].getAttribute('data-page-link') === name;
      pageLinks[l].classList.toggle('is-active', linkOn);
      if (linkOn) pageLinks[l].setAttribute('aria-current', 'page');
      else pageLinks[l].removeAttribute('aria-current');
    }

    if (window.history && window.history.replaceState) {
      var hash = name === 'dashboard' ? '' : '#' + name;
      window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
    }
  }

  for (var pl = 0; pl < pageLinks.length; pl += 1) {
    pageLinks[pl].addEventListener('click', function (event) {
      event.preventDefault();
      showPage(this.getAttribute('data-page-link'));
    });
  }

  if (pages.length) showPage(window.location.hash === '#menu' ? 'menu' : 'dashboard');

  window.addEventListener('hashchange', function () {
    if (pages.length) showPage(window.location.hash === '#menu' ? 'menu' : 'dashboard');
  });

  /* ---------------------------- notification panel ---------------------------- */

  var notifBtn = document.querySelector('[data-notif-toggle]');
  var notifPanel = document.querySelector('[data-notif-panel]');
  var notifList = document.querySelector('[data-notif-list]');
  var notifBadge = document.querySelector('[data-notif-count]');
  var readAlerts = {};
  var currentAlerts = [];

  function setNotifBadge(count) {
    if (notifBadge) {
      notifBadge.textContent = count;
      notifBadge.hidden = count === 0;
    }
    if (notifBtn) {
      notifBtn.setAttribute('aria-label', count === 0 ? 'Notifications, none unread' : 'Notifications, ' + count + ' unread');
    }
  }

  if (notifBtn && notifPanel) {
    var setNotifOpen = function (open) {
      notifPanel.hidden = !open;
      notifBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    notifBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      setNotifOpen(notifPanel.hidden);
    });

    document.addEventListener('click', function (event) {
      if (notifPanel.hidden) return;
      if (notifPanel.contains(event.target) || notifBtn.contains(event.target)) return;
      setNotifOpen(false);
    });

    var clearNotifs = notifPanel.querySelector('[data-notif-clear]');
    if (clearNotifs) {
      clearNotifs.addEventListener('click', function () {
        for (var a = 0; a < currentAlerts.length; a += 1) readAlerts[currentAlerts[a].id] = true;
        var unread = notifPanel.querySelectorAll('.notif-item.is-unread');
        for (var u = 0; u < unread.length; u += 1) unread[u].classList.remove('is-unread');
        setNotifBadge(0);
      });
    }
  }

  function alertIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.6V12l3 1.8" /></svg>';
  }

  function formatClock(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes + ' ' + suffix;
  }

  function getAlertTime(order) {
    var meta = order.querySelector('.elapsed-meta');
    var match = meta ? /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(meta.textContent) : null;
    var now = new Date();
    if (!match) return formatClock(now);

    var hours = parseInt(match[1], 10) % 12;
    if (match[3].toUpperCase() === 'PM') hours += 12;

    var placed = new Date(now.getTime());
    placed.setHours(hours, parseInt(match[2], 10), 0, 0);
    if (placed.getTime() > now.getTime() + 3600000) placed.setDate(placed.getDate() - 1);

    return formatClock(new Date(placed.getTime() + alertMinutes * 60000));
  }

  function makeAlertItem(alert) {
    var item = document.createElement('li');
    item.className = 'notif-item' + (alert.read ? '' : ' is-unread');

    var icon = document.createElement('span');
    icon.className = 'notif-ic is-warn';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = alertIcon();

    var body = document.createElement('span');
    body.className = 'notif-body';

    var title = document.createElement('span');
    title.className = 'notif-title';
    title.textContent = alert.title;

    var text = document.createElement('span');
    text.className = 'notif-text';
    text.textContent = alert.text;

    var time = document.createElement('span');
    time.className = 'notif-time';
    time.textContent = 'Updated at ' + alert.at;

    body.appendChild(title);
    body.appendChild(text);
    body.appendChild(time);
    item.appendChild(icon);
    item.appendChild(body);
    return item;
  }

  function makeEmptyAlerts() {
    var item = document.createElement('li');
    item.className = 'notif-empty';

    var icon = document.createElement('span');
    icon.className = 'notif-ic is-ok';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15.5 9 10l3.5 3.5L20 6" /><path d="M15.5 6H20v4.5" /></svg>';

    var text = document.createElement('span');
    text.textContent = 'No delayed orders. Everything is inside the ' + alertMinutes + '-minute alert window.';

    item.appendChild(icon);
    item.appendChild(text);
    return item;
  }

  function renderNotifications() {
    if (!notifList) return;

    var orders = document.querySelectorAll('.order[data-order-id]');
    var alerts = [];

    for (var i = 0; i < orders.length; i += 1) {
      var order = orders[i];
      var state = order.getAttribute('data-order-state');
      var minutes = parseInt(order.getAttribute('data-minutes'), 10);
      if (!isFinite(minutes) || minutes <= alertMinutes) continue;
      if (state === 'ready') continue;

      var id = order.getAttribute('data-order-id');
      var tag = order.querySelector('.order-tags .tag');
      var meta = tag ? tag.textContent.replace(/\s+/g, ' ').trim() : '';
      var stateLabel = STATE_LABEL[state] || state;

      alerts.push({
        id: id,
        minutes: minutes,
        title: 'Order ' + id + ' has passed ' + alertMinutes + ' minutes',
        text: stateLabel + ' \u00b7 ' + minutes + ' min elapsed' + (meta ? ' \u00b7 ' + meta : ''),
        at: getAlertTime(order),
        read: !!readAlerts[id]
      });
    }

    alerts.sort(function (a, b) { return b.minutes - a.minutes; });
    currentAlerts = alerts;

    notifList.innerHTML = '';
    if (!alerts.length) {
      notifList.appendChild(makeEmptyAlerts());
    } else {
      for (var a = 0; a < alerts.length; a += 1) notifList.appendChild(makeAlertItem(alerts[a]));
    }

    var unreadCount = 0;
    for (var c = 0; c < alerts.length; c += 1) {
      if (!alerts[c].read) unreadCount += 1;
    }
    setNotifBadge(unreadCount);
  }

  /* ------------------------------ order board ------------------------------ */

  var STATE_LABEL = { waiting: 'Waiting', preparing: 'Preparing', ready: 'Ready' };

  function updateBoardCounts() {
    var counts = { waiting: 0, preparing: 0, ready: 0 };
    var orders = document.querySelectorAll('#view-orders .order[data-order-state]');
    if (!orders.length) return;

    for (var i = 0; i < orders.length; i += 1) {
      var state = orders[i].getAttribute('data-order-state');
      if (Object.prototype.hasOwnProperty.call(counts, state)) counts[state] += 1;
    }

    var preparingLine = counts.preparing + counts.ready;
    var waitingCount = document.querySelector('[data-status-count="waiting"]');
    var preparingCount = document.querySelector('[data-status-count="preparing"]');
    if (waitingCount) waitingCount.textContent = counts.waiting;
    if (preparingCount) preparingCount.textContent = preparingLine;

    var active = counts.waiting + preparingLine;
    var navActive = document.querySelector('[data-nav-active]');
    var metricActive = document.querySelector('[data-metric-active]');
    if (navActive) navActive.textContent = active;
    if (metricActive) metricActive.textContent = active;
  }

  function applyLateState() {
    var orders = document.querySelectorAll('.order[data-minutes]');
    if (!orders.length) return;
    var late = 0;

    for (var i = 0; i < orders.length; i += 1) {
      var order = orders[i];
      var minutes = parseInt(order.getAttribute('data-minutes'), 10);
      var state = order.getAttribute('data-order-state');
      var isLate = isFinite(minutes) && minutes > alertMinutes && state !== 'ready';
      order.classList.toggle('is-late', isLate);
      if (isLate) late += 1;
    }

    var metricLate = document.querySelector('[data-metric-late]');
    if (metricLate) metricLate.textContent = late;
  }

  /* ------------------------------ sidebar status filters ------------------------------ */

  var statusFilters = document.querySelectorAll('[data-status-filter]');
  var activeStatusFilter = null;

  function applyStatusFilter(name) {
    if (!document.querySelector('#view-orders')) return;
    activeStatusFilter = name || null;

    var dashboardNav = document.querySelector('[data-page-link="dashboard"]');
    if (dashboardNav) {
      var dashboardOn = !activeStatusFilter;
      dashboardNav.classList.toggle('is-active', dashboardOn);
      if (dashboardOn) dashboardNav.setAttribute('aria-current', 'page');
      else dashboardNav.removeAttribute('aria-current');
    }

    var orders = document.querySelectorAll('#view-orders .order[data-order-state]');
    for (var i = 0; i < orders.length; i += 1) {
      var state = orders[i].getAttribute('data-order-state');
      var on = !activeStatusFilter || state === activeStatusFilter || (activeStatusFilter === 'preparing' && state === 'ready');
      orders[i].classList.toggle('is-filtered', !on);
    }

    for (var f = 0; f < statusFilters.length; f += 1) {
      var onFilter = statusFilters[f].getAttribute('data-status-filter') === activeStatusFilter;
      statusFilters[f].classList.toggle('is-active', onFilter);
      statusFilters[f].setAttribute('aria-current', onFilter ? 'true' : 'false');
    }
  }

  for (var sf = 0; sf < statusFilters.length; sf += 1) {
    statusFilters[sf].addEventListener('click', function (event) {
      if (!document.querySelector('#view-orders')) return;
      event.preventDefault();
      var name = this.getAttribute('data-status-filter');
      var next = activeStatusFilter === name ? null : name;
      showPage('dashboard');
      applyStatusFilter(next);
      if (typeof setView === 'function') setView('orders');
      if (live) live.textContent = next ? 'Showing ' + STATE_LABEL[next] + ' orders.' : 'Showing all active orders.';
    });
  }

  var dashboardLinks = document.querySelectorAll('[data-page-link="dashboard"]');
  for (var dl = 0; dl < dashboardLinks.length; dl += 1) {
    dashboardLinks[dl].addEventListener('click', function () { applyStatusFilter(null); });
  }

  document.addEventListener('click', function (event) {
    var btn = event.target.closest ? event.target.closest('[data-order-advance]') : null;
    if (!btn || btn.disabled) return;

    var card = btn.closest('.order');
    if (!card) return;
    if (card.getAttribute('data-live') === '1') return;   // live orders are handled by orders.js

    var state = card.getAttribute('data-order-state');
    var chip = card.querySelector('[data-state-chip]');
    var orderId = card.getAttribute('data-order-id') || 'Order';

    if (state === 'waiting') {
      card.setAttribute('data-order-state', 'preparing');
      if (chip) {
        chip.className = 'state-chip is-preparing';
        chip.textContent = STATE_LABEL.preparing;
      }
      btn.textContent = 'Mark as ready';

      if (live) live.textContent = orderId + ' moved to preparing.';
    } else if (state === 'preparing') {
      card.setAttribute('data-order-state', 'ready');
      if (chip) {
        chip.className = 'state-chip is-ready';
        chip.textContent = STATE_LABEL.ready;
      }
      btn.textContent = 'Ready for hand-off';
      btn.disabled = true;

      if (live) live.textContent = orderId + ' is now ready.';
    } else {
      return;
    }

    updateBoardCounts();
    applyStatusFilter(activeStatusFilter);
    applyLateState();
    renderNotifications();
  });

  /* ------------------------------ view switch ------------------------------ */

  var viewButtons = document.querySelectorAll('[data-view-btn]');
  if (viewButtons.length) {
    var views = {};
    var viewSections = document.querySelectorAll('[data-view]');
    for (var vs = 0; vs < viewSections.length; vs += 1) {
      views[viewSections[vs].getAttribute('data-view')] = viewSections[vs];
    }

    var setView = function (name) {
      for (var key in views) {
        if (!Object.prototype.hasOwnProperty.call(views, key)) continue;
        views[key].hidden = key !== name;
      }
      for (var b = 0; b < viewButtons.length; b += 1) {
        var on = viewButtons[b].getAttribute('data-view-btn') === name;
        viewButtons[b].classList.toggle('is-active', on);
        viewButtons[b].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    };

    for (var vb = 0; vb < viewButtons.length; vb += 1) {
      viewButtons[vb].addEventListener('click', function () {
        var nextView = this.getAttribute('data-view-btn');
        if (nextView !== 'orders') applyStatusFilter(null);
        setView(nextView);
      });
    }
  }

  /* ------------------------------ status jumps ------------------------------ */

  var statusTabs = document.querySelectorAll('[data-status-target]');

  for (var st = 0; st < statusTabs.length; st += 1) {
    statusTabs[st].addEventListener('click', function () {
      var targetName = this.getAttribute('data-status-target');
      var target = document.getElementById('col-' + targetName);
      if (!target) return;

      for (var t = 0; t < statusTabs.length; t += 1) {
        statusTabs[t].classList.toggle('is-active', statusTabs[t] === this);
      }

      target.classList.add('is-focused');
      window.setTimeout(function () { target.classList.remove('is-focused'); }, 1400);

      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (target.scrollIntoView) {
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }

  /* ------------------------------ alert settings ------------------------------ */

  var alertModal = document.querySelector('[data-alert-modal]');
  var alertInput = document.querySelector('[data-alert-input]');
  var alertForm = document.querySelector('[data-alert-form]');
  var alertOpeners = document.querySelectorAll('[data-alert-settings]');
  var alertClosers = document.querySelectorAll('[data-alert-close]');
  var presets = document.querySelectorAll('[data-preset]');
  var lastAlertTrigger = null;

  function updateAlertLabels() {
    var labels = document.querySelectorAll('[data-alert-value]');
    for (var i = 0; i < labels.length; i += 1) labels[i].textContent = alertMinutes + ' min';
  }

  function syncPresets() {
    var current = alertInput ? parseInt(alertInput.value, 10) : alertMinutes;
    for (var i = 0; i < presets.length; i += 1) {
      presets[i].classList.toggle('is-active', parseInt(presets[i].getAttribute('data-preset'), 10) === current);
    }
  }

  function openAlertModal() {
    if (!alertModal) return;
    lastAlertTrigger = document.activeElement;
    if (alertInput) alertInput.value = alertMinutes;
    syncPresets();
    alertModal.hidden = false;
    document.body.classList.add('is-modal-open');
    if (alertInput) {
      alertInput.focus();
      alertInput.select();
    }
  }

  function closeAlertModal() {
    if (!alertModal || alertModal.hidden) return;
    alertModal.hidden = true;
    document.body.classList.remove('is-modal-open');
    if (lastAlertTrigger && lastAlertTrigger.focus) lastAlertTrigger.focus();
  }

  for (var ao = 0; ao < alertOpeners.length; ao += 1) {
    alertOpeners[ao].addEventListener('click', openAlertModal);
  }

  for (var ac = 0; ac < alertClosers.length; ac += 1) {
    alertClosers[ac].addEventListener('click', closeAlertModal);
  }

  for (var pi = 0; pi < presets.length; pi += 1) {
    presets[pi].addEventListener('click', function () {
      if (alertInput) alertInput.value = this.getAttribute('data-preset');
      syncPresets();
    });
  }

  if (alertInput) {
    alertInput.addEventListener('input', syncPresets);
  }

  if (alertForm) {
    alertForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var value = alertInput ? parseInt(alertInput.value, 10) : alertMinutes;
      if (!isFinite(value)) value = DEFAULT_ALERT;
      value = Math.min(MAX_ALERT, Math.max(MIN_ALERT, value));
      alertMinutes = value;
      writeStorage(ALERT_KEY, String(value));
      updateAlertLabels();
      closeAlertModal();
      applyLateState();
      renderNotifications();
      if (live) live.textContent = 'Kitchen alert interval set to ' + value + ' minutes.';
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;

    if (alertModal && !alertModal.hidden) {
      closeAlertModal();
      return;
    }
    if (notifPanel && !notifPanel.hidden) {
      notifPanel.hidden = true;
      if (notifBtn) {
        notifBtn.setAttribute('aria-expanded', 'false');
        notifBtn.focus();
      }
    }
  });

  /* orders.js re-renders the board; refresh the badges and delayed alerts too. */
  document.addEventListener('kg:orders-changed', function () {
    updateBoardCounts();
    applyLateState();
    renderNotifications();
  });

  /* ------------------------------ initial paint ------------------------------ */

  updateAlertLabels();
  updateBoardCounts();
  applyLateState();
  renderNotifications();
})();
