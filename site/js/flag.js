/* A Baltimore city flag that waves gently. Drawn on a canvas in thin vertical strips, each shifted and shaded
   along a travelling wave, so it costs a few kilobytes instead of a video. The flag image (public domain, Wikimedia
   Commons) is fetched by pipeline/images.py; if it isn't there, nothing is shown. Holds still for reduced motion. */
const FLAG = (() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const src = "img/baltimore-flag.png";
  let img = null, ready = null;
  const load = () => ready || (ready = new Promise((ok, no) => { img = new Image(); img.onload = () => ok(img); img.onerror = no; img.src = src; }));

  function mount(canvas, { pole = false, amp = 0.07, speed = 1 } = {}) {
    if (!canvas) return;
    load().then(() => {
      const ctx = canvas.getContext("2d"); let vis = true, W, H, dpr, fw, fh, px;
      const size = () => {
        dpr = Math.min(2, devicePixelRatio || 1); W = canvas.clientWidth; H = canvas.clientHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        px = pole ? Math.max(3, W * 0.05) : 0; fw = W - px - 2; fh = Math.min(H * 0.82, fw * 2 / 3);
      };
      size(); addEventListener("resize", size);
      new IntersectionObserver(e => vis = e[0].isIntersecting).observe(canvas);
      const draw = t => {
        ctx.clearRect(0, 0, W, H);
        const top = (H - fh) / 2, A = fh * amp, step = 1, iw = img.naturalWidth, ih = img.naturalHeight;
        if (pole) { ctx.fillStyle = "#c9cdd2"; ctx.fillRect(0, 0, Math.max(2, px * 0.45), H); ctx.beginPath(); ctx.arc(px * 0.22, 2, px * 0.4, 0, 6.28); ctx.fill(); }
        for (let x = 0; x < fw; x += step) {
          const k = x / fw, ph = k * 6.2 - t * 0.0026 * speed;
          const dy = Math.sin(ph) * A * k, sh = Math.cos(ph) * 0.16 * k;           // fixed at the pole, freer at the end
          ctx.drawImage(img, k * iw, 0, Math.max(1, iw / fw), ih, px + x, top + dy, step + 0.6, fh);
          if (sh) { ctx.fillStyle = sh > 0 ? `rgba(255,255,255,${sh * 0.55})` : `rgba(0,0,0,${-sh})`; ctx.fillRect(px + x, top + dy, step + 0.6, fh); }
        }
      };
      if (reduce) { draw(900); return; }
      const loop = t => { requestAnimationFrame(loop); if (vis && !document.hidden) draw(t); };
      requestAnimationFrame(loop);
      canvas.classList.add("on");
    }).catch(() => canvas.remove());
  }
  return { mount };
})();
