(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const button = document.querySelector('.motion-toggle');
  let paused = false, visible = false, frame = 0, last = 0, phase = 0;
  let bounds = { width: 0, height: 0 }, dpr = 1;
  function draw(time) {
    frame = 0;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    phase += last ? Math.min(time - last, 50) * .0001 : 0; last = time;
    context.fillStyle = '#005dcc';
    for (let i = 0; i < 42; i++) {
      const angle = i * 2.39996 + phase;
      const radius = Math.sqrt((i + 1) / 43) * bounds.width * .48;
      context.globalAlpha = .15 + (i % 5) * .08;
      context.beginPath(); context.arc(bounds.width / 2 + Math.cos(angle) * radius, bounds.height / 2 + Math.sin(angle) * radius * .8, 1.5 + i % 3, 0, Math.PI * 2); context.fill();
    }
    if (visible && !paused && !reduced.matches && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function update() {
    cancelAnimationFrame(frame); last = 0;
    button.hidden = reduced.matches;
    button.textContent = paused ? '動きを再開する' : '動きを止める';
    draw(performance.now());
  }
  button.addEventListener('click', () => { paused = !paused; update(); });
  reduced.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update(); }).observe(canvas);
  new ResizeObserver(entries => {
    bounds = entries[0].contentRect;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(bounds.width * dpr); canvas.height = Math.round(bounds.height * dpr);
    update();
  }).observe(canvas);
})();
