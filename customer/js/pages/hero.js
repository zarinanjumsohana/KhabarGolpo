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
    body.classList.add('is-mounted');
    body.classList.add('hero-on');
  }

  /* nav box: immediately styled for hero, then observed */
  topbar.classList.add('hero-view');
  const heroWatch = new IntersectionObserver(([entry]) => {
    topbar.classList.toggle('hero-view', entry.intersectionRatio > 0.35);
  }, { threshold: [0, 0.35, 1] });
  heroWatch.observe(hero);

  /* staff login: the three-line button opens the login page directly (no popup) */
  menuBtn.addEventListener('click', () => {
    location.href = '../Admin%20Panel/admin/login.html';
  });
})();