(function () {
  'use strict';

  var THEME_KEY = 'kg.kitchen.theme';
  var ALERT_KEY = 'kg.kitchen.alertMinutes';
  var SOLD_KEY = 'kg.kitchen.soldout';
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

  function readSoldOut() {
    var raw = readStorage(SOLD_KEY);
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  var alertMinutes = readAlertMinutes();
  var soldOut = {};

  /* ------------------------------ page switch ------------------------------ */

  var pageLinks = Array.prototype.slice.call(document.querySelectorAll('[data-page-link]'));
  var pages = Array.prototype.slice.call(document.querySelectorAll('[data-page]'));
  var live = document.querySelector('[data-live]');
  var menuLive = document.querySelector('[data-menu-live]');

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

  var toastHost = null;
  var announcedAlerts = {};

  function ensureToastHost() {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toast-host';
      toastHost.setAttribute('aria-live', 'polite');
      toastHost.setAttribute('aria-atomic', 'false');
      document.body.appendChild(toastHost);
    }
    return toastHost;
  }

  function dismissToast(el) {
    if (!el || el.classList.contains('is-out')) return;
    el.classList.remove('is-in');
    el.classList.add('is-out');
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 460);
  }

  function showAlertToast(alert) {
    var host = ensureToastHost();
    var el = document.createElement('article');
    el.className = 'k-toast';
    el.setAttribute('role', 'status');

    var icon = document.createElement('span');
    icon.className = 'k-toast-ic';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = alertIcon();

    var body = document.createElement('div');
    body.className = 'k-toast-body';

    var eyebrow = document.createElement('span');
    eyebrow.className = 'k-toast-eyebrow';
    eyebrow.textContent = 'Delayed order';

    var title = document.createElement('strong');
    title.className = 'k-toast-title';
    title.textContent = alert.title;

    var message = document.createElement('span');
    message.className = 'k-toast-msg';
    message.textContent = alert.text;

    var time = document.createElement('span');
    time.className = 'k-toast-time';
    time.textContent = 'Updated at ' + alert.at;

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'k-toast-x';
    close.setAttribute('aria-label', 'Dismiss alert');
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="m6.5 6.5 11 11M17.5 6.5l-11 11" /></svg>';
    close.addEventListener('click', function () { dismissToast(el); });

    body.appendChild(eyebrow);
    body.appendChild(title);
    if (alert.text) body.appendChild(message);
    body.appendChild(time);
    el.appendChild(icon);
    el.appendChild(body);
    el.appendChild(close);
    host.appendChild(el);

    requestAnimationFrame(function () { el.classList.add('is-in'); });
    window.setTimeout(function () { dismissToast(el); }, 6500);
  }

  function announceAlerts(alerts) {
    var fresh = [];
    for (var i = 0; i < alerts.length; i += 1) {
      if (announcedAlerts[alerts[i].id]) continue;
      announcedAlerts[alerts[i].id] = true;
      fresh.push(alerts[i]);
    }
    for (var f = 0; f < fresh.length; f += 1) {
      (function (alert, index) {
        window.setTimeout(function () { showAlertToast(alert); }, 450 + index * 750);
      }(fresh[f], f));
    }
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

    var hasBoard = !!document.querySelector('[data-board-col]');
    if (!hasBoard) {
      var staticUnread = notifList.querySelectorAll('.notif-item.is-unread').length;
      setNotifBadge(staticUnread);

      var staticAlerts = [];
      var staticItems = notifList.querySelectorAll('.notif-item');
      for (var s = 0; s < staticItems.length; s += 1) {
        var sTitle = staticItems[s].querySelector('.notif-title');
        if (!sTitle) continue;
        var sText = staticItems[s].querySelector('.notif-text');
        var sTime = staticItems[s].querySelector('.notif-time');
        var sIdMatch = /Order\s+([A-Z0-9-]+)/i.exec(sTitle.textContent);
        staticAlerts.push({
          id: sIdMatch ? sIdMatch[1] : 'static-' + s,
          title: sTitle.textContent.trim(),
          text: sText ? sText.textContent.trim() : '',
          at: sTime ? sTime.textContent.replace(/^Updated at\s*/i, '').trim() : formatClock(new Date())
        });
      }
      announceAlerts(staticAlerts);
      return;
    }

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
    announceAlerts(alerts);
  }

  /* ------------------------------ order board ------------------------------ */

  var STATE_LABEL = { waiting: 'Waiting', preparing: 'Preparing', ready: 'Ready' };

  function updateBoardCounts() {
    var counts = { pending: 0, preparing: 0, completed: 0 };
    var names = ['pending', 'preparing', 'completed'];

    for (var n = 0; n < names.length; n += 1) {
      var name = names[n];
      var body = document.querySelector('[data-column-body="' + name + '"]');
      if (!body) continue;
      counts[name] = name === 'completed'
        ? body.querySelectorAll('.done-card').length
        : body.querySelectorAll('.order').length;
    }

    for (var c = 0; c < names.length; c += 1) {
      var key = names[c];
      var colCount = document.querySelector('[data-col-count="' + key + '"]');
      var tabCount = document.querySelector('[data-tab-count="' + key + '"]');
      if (colCount) colCount.textContent = counts[key];
      if (tabCount) tabCount.textContent = counts[key];
    }

    var active = counts.pending + counts.preparing;
    var navActive = document.querySelector('[data-nav-active]');
    var metricActive = document.querySelector('[data-metric-active]');
    if (navActive) navActive.textContent = active;
    if (metricActive) metricActive.textContent = active;
  }

  function applyLateState() {
    var orders = document.querySelectorAll('.order[data-minutes]');
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

  document.addEventListener('click', function (event) {
    var btn = event.target.closest ? event.target.closest('[data-order-advance]') : null;
    if (!btn || btn.disabled) return;

    var card = btn.closest('.order');
    if (!card) return;

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

      var preparingBody = document.querySelector('[data-column-body="preparing"]');
      if (preparingBody) preparingBody.appendChild(card);

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
        setView(this.getAttribute('data-view-btn'));
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

  /* ------------------------------ menu / sold out ------------------------------ */

  function persistSoldOut() {
    var list = [];
    for (var key in soldOut) {
      if (Object.prototype.hasOwnProperty.call(soldOut, key) && soldOut[key]) list.push(key);
    }
    writeStorage(SOLD_KEY, JSON.stringify(list));
  }

  function updateMenuSummary() {
    var cards = document.querySelectorAll('[data-menu-card]');
    var total = cards.length;
    var sold = 0;

    for (var i = 0; i < cards.length; i += 1) {
      var name = cards[i].getAttribute('data-menu-card');
      if (soldOut[name]) sold += 1;
    }

    var availableEl = document.querySelector('[data-menu-available]');
    var soldEl = document.querySelector('[data-menu-soldout]');
    var navEl = document.querySelector('[data-menu-nav-count]');
    if (availableEl) availableEl.textContent = Math.max(0, total - sold);
    if (soldEl) soldEl.textContent = sold;
    if (navEl) navEl.textContent = Math.max(0, total - sold);
  }

  function applySoldOutVisual(name) {
    var sold = !!soldOut[name];
    var toggles = document.querySelectorAll('[data-soldout-toggle]');

    for (var i = 0; i < toggles.length; i += 1) {
      if (toggles[i].getAttribute('data-soldout-toggle') !== name) continue;
      toggles[i].setAttribute('aria-checked', sold ? 'true' : 'false');
      toggles[i].setAttribute('aria-label', sold ? 'Mark ' + name + ' as available' : 'Mark ' + name + ' as sold out');

      var card = toggles[i].closest ? toggles[i].closest('[data-menu-card]') : null;
      if (card) card.classList.toggle('is-soldout', sold);

      var label = toggles[i].querySelector('[data-soldout-label]');
      if (label) label.textContent = sold ? 'Sold out' : 'Available';
    }

    var items = document.querySelectorAll('[data-item-name]');
    for (var j = 0; j < items.length; j += 1) {
      if (items[j].getAttribute('data-item-name') !== name) continue;
      items[j].classList.toggle('is-soldout', sold);
    }
  }

  function setSoldOut(name, sold) {
    if (sold) soldOut[name] = true;
    else delete soldOut[name];

    persistSoldOut();
    applySoldOutVisual(name);
    updateMenuSummary();

    if (menuLive) menuLive.textContent = name + (sold ? ' marked as sold out.' : ' marked as available.');
  }

  document.addEventListener('click', function (event) {
    var btn = event.target.closest ? event.target.closest('[data-soldout-toggle]') : null;
    if (!btn) return;

    var name = btn.getAttribute('data-soldout-toggle');
    setSoldOut(name, !soldOut[name]);
  });

  var storedSoldOut = readSoldOut();
  for (var so = 0; so < storedSoldOut.length; so += 1) {
    if (typeof storedSoldOut[so] === 'string') soldOut[storedSoldOut[so]] = true;
  }

  var soldToggles = document.querySelectorAll('[data-soldout-toggle]');
  for (var stg = 0; stg < soldToggles.length; stg += 1) {
    applySoldOutVisual(soldToggles[stg].getAttribute('data-soldout-toggle'));
  }
  updateMenuSummary();

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

  /* ------------------------------ initial paint ------------------------------ */

  updateAlertLabels();
  updateBoardCounts();
  applyLateState();
  renderNotifications();
})();
