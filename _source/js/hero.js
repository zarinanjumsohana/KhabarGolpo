/* KhabarGolpo hero: video, door placement, entrance timing, nav box visibility, login panel */
(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s);
  const body = document.body;
  const hero = $('#hero');
  const video = $('#bgVideo');
  const door = $('#door');
  const topbar = $('#topbar');
  const menuBtn = $('#menuBtn');
  const panel = $('#loginPanel');
  const form = $('#loginForm');
  const note = $('#loginNote');

  /*
   * Door position, as fractions of the video frame (0 to 1).
   * x, y = top-left corner of the door; w, h = its width and height.
   * Open index.html?door to see the yellow box and adjust these four numbers.
   */
  const DOOR = { x: 0.385, y: 0.16, w: 0.235, h: 0.48 };
  if (location.search.includes('door')) door.classList.add('debug');

  /* place the door where the video shows it, matching object-fit: cover */
  function placeDoor() {
    const r = hero.getBoundingClientRect();
    const vw = video.videoWidth || 16, vh = video.videoHeight || 9; // 16:9 until metadata loads
    const s = Math.max(r.width / vw, r.height / vh);
    const dw = vw * s, dh = vh * s;
    const ox = (r.width - dw) / 2, oy = (r.height - dh) / 2;

    door.style.left = (ox + DOOR.x * dw) + 'px';
    door.style.top = (oy + DOOR.y * dh) + 'px';
    door.style.width = (DOOR.w * dw) + 'px';
    door.style.height = (DOOR.h * dh) + 'px';
  }
  video.addEventListener('loadedmetadata', placeDoor);
  addEventListener('resize', placeDoor);
  placeDoor();

  /* video: fade it in as soon as its first frame is ready, not after the page has settled */
  function markVideoReady() {
    hero.classList.add('video-ready');
  }
  if (video.readyState >= 2) markVideoReady();          // already loaded from cache
  video.addEventListener('loadeddata', markVideoReady); // first frame available
  video.addEventListener('playing', markVideoReady);
  video.addEventListener('loadeddata', () => {
    if (RM) video.pause();                              // reduced motion: keep one still frame
  });

  /* start playing straight away */
  if (!RM) video.play().catch(() => {});

  /* entrance: top bar at 100ms, scene and text at 300ms */
  if (RM) {
    body.classList.add('is-mounted', 'hero-on');
  } else {
    setTimeout(() => body.classList.add('is-mounted'), 100);
    setTimeout(() => body.classList.add('hero-on'), 300);
  }

  /* nav box: visible only while the hero is on screen (more than 35% of it), so it never sits over the story */
  const heroWatch = new IntersectionObserver(([entry]) => {
    topbar.classList.toggle('hero-view', entry.intersectionRatio > 0.35);
  }, { threshold: [0, 0.35, 1] });
  heroWatch.observe(hero);

  /* login panel: opens from the three-line button */
  let open = false;
  function setLogin(v) {
    open = v;
    panel.classList.toggle('open', v);
    panel.setAttribute('aria-hidden', String(!v));
    panel.inert = !v;
    menuBtn.setAttribute('aria-expanded', String(v));
    menuBtn.setAttribute('aria-label', v ? 'Close login' : 'Admin and chef login');
    if (v) setTimeout(() => form.email.focus(), 300);
  }
  menuBtn.addEventListener('click', () => setLogin(!open));
  document.addEventListener('click', e => {
    if (open && !panel.contains(e.target) && !menuBtn.contains(e.target)) setLogin(false);
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && open) { setLogin(false); menuBtn.focus(); }
  });

  /* login submit: until the team's auth code is connected, it goes to the admin login page */
  form.addEventListener('submit', e => {
    e.preventDefault();
    note.textContent = '';
    if (!form.email.value.trim() || !form.password.value) {
      note.textContent = 'Enter your email and password.';
      return;
    }
    // Connection point: when js/api/auth.js is shared, sign in here instead of redirecting.
    location.href = 'admin/login.html';
  });
})();