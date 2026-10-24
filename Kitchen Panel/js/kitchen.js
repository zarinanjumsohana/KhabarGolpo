(function () {
  'use strict';

  var THEME_KEY = 'kg.kitchen.theme';
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
      /* private mode: theme still applies for this session */
    }
    return applyTheme(theme);
  }

  var toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    toggle.addEventListener('click', function () {
      setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
  }
  applyTheme(getTheme());

  var notifBtn = document.querySelector('[data-notif-toggle]');
  var notifPanel = document.querySelector('[data-notif-panel]');

  if (notifBtn && notifPanel) {
    function setOpen(open) {
      notifPanel.hidden = !open;
      notifBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    notifBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      setOpen(notifPanel.hidden);
    });

    document.addEventListener('click', function (event) {
      if (notifPanel.hidden) return;
      if (notifPanel.contains(event.target) || notifBtn.contains(event.target)) return;
      setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || notifPanel.hidden) return;
      setOpen(false);
      notifBtn.focus();
    });

    var clear = notifPanel.querySelector('[data-notif-clear]');
    if (clear) {
      clear.addEventListener('click', function () {
        var items = notifPanel.querySelectorAll('.notif-item.is-unread');
        for (var i = 0; i < items.length; i += 1) items[i].classList.remove('is-unread');
        var badge = document.querySelector('[data-notif-count]');
        if (badge) badge.hidden = true;
        notifBtn.setAttribute('aria-label', 'Notifications, none unread');
      });
    }
  }

  /* Order pipeline: Waiting -> Preparing -> Ready */
  var NEXT_STATE = { waiting: 'preparing', preparing: 'ready' };
  var STATE_LABEL = { waiting: 'Waiting', preparing: 'Preparing', ready: 'Ready' };
  var ACTION_LABEL = { preparing: 'Mark as ready', ready: 'Ready for hand-off' };
  var live = document.querySelector('[data-live]');

  document.addEventListener('click', function (event) {
    var btn = event.target.closest ? event.target.closest('[data-order-advance]') : null;
    if (!btn || btn.disabled) return;

    var card = btn.closest('.order');
    if (!card) return;

    var state = card.getAttribute('data-order-state');
    var next = NEXT_STATE[state];
    if (!next) return;

    card.setAttribute('data-order-state', next);

    var chip = card.querySelector('[data-state-chip]');
    if (chip) {
      chip.className = 'state-chip is-' + next;
      chip.textContent = STATE_LABEL[next];
    }

    btn.textContent = ACTION_LABEL[next];
    if (next === 'ready') btn.disabled = true;

    if (live) {
      var id = card.getAttribute('data-order-id') || 'Order';
      live.textContent = id + ' is now ' + STATE_LABEL[next].toLowerCase() + '.';
    }
  });

  /* By Order / By Items view switch */
  var viewButtons = document.querySelectorAll('[data-view-btn]');
  if (viewButtons.length) {
    var views = {};
    var sections = document.querySelectorAll('[data-view]');
    for (var s = 0; s < sections.length; s += 1) {
      views[sections[s].getAttribute('data-view')] = sections[s];
    }

    var setView = function (name) {
      for (var key in views) {
        if (!Object.prototype.hasOwnProperty.call(views, key)) continue;
        views[key].hidden = key !== name;
      }
      for (var i = 0; i < viewButtons.length; i += 1) {
        var on = viewButtons[i].getAttribute('data-view-btn') === name;
        viewButtons[i].classList.toggle('is-active', on);
        viewButtons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    };

    for (var b = 0; b < viewButtons.length; b += 1) {
      viewButtons[b].addEventListener('click', function () {
        setView(this.getAttribute('data-view-btn'));
      });
    }
  }
})();
