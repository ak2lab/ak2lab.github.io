(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const toggle = document.querySelector('[data-motion-toggle]');

  function storedMotion() {
    try { return localStorage.getItem('motion'); } catch { return null; }
  }
  function storeMotion(value) {
    try { localStorage.setItem('motion', value); } catch { /* 保存できない環境では記憶しない */ }
  }
  const moving = () => root.dataset.motion !== 'off' && !reduced.matches;

  // 動きの停止。3Dの描画も同じ状態を見る
  function applyMotion(value) {
    root.dataset.motion = value;
    if (toggle) {
      toggle.textContent = value === 'off' ? '動きを再開する' : '動きを止める';
      toggle.hidden = reduced.matches;
    }
    document.dispatchEvent(new CustomEvent('motionchange'));
  }
  applyMotion(storedMotion() === 'off' ? 'off' : 'on');
  toggle?.addEventListener('click', () => {
    const next = root.dataset.motion === 'off' ? 'on' : 'off';
    storeMotion(next);
    applyMotion(next);
  });
  reduced.addEventListener('change', () => applyMotion(root.dataset.motion));

  // ポインターの位置に置く光。更新は1フレームに1回
  let glowFrame = 0, glowX = 0, glowY = 0;
  addEventListener('pointermove', event => {
    if (!finePointer.matches) return;
    glowX = event.clientX; glowY = event.clientY;
    if (glowFrame) return;
    glowFrame = requestAnimationFrame(() => {
      glowFrame = 0;
      root.style.setProperty('--px', `${glowX}px`);
      root.style.setProperty('--py', `${glowY}px`);
    });
  }, { passive: true });

  // カードの光と傾き
  for (const card of document.querySelectorAll('[data-case]')) {
    let frame = 0, x = 0, y = 0;
    card.addEventListener('pointermove', event => {
      if (!finePointer.matches) return;
      x = event.clientX; y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const box = card.getBoundingClientRect();
        const u = (x - box.left) / box.width, v = (y - box.top) / box.height;
        card.style.setProperty('--mx', `${u * 100}%`);
        card.style.setProperty('--my', `${v * 100}%`);
        const tilt = moving() ? 7 : 0;
        card.style.setProperty('--rx', `${(0.5 - v) * tilt}deg`);
        card.style.setProperty('--ry', `${(u - 0.5) * tilt}deg`);
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame); frame = 0;
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }

  // 磁石のように寄るボタン
  for (const button of document.querySelectorAll('[data-magnetic]')) {
    button.addEventListener('pointermove', event => {
      if (!finePointer.matches || !moving()) return;
      const box = button.getBoundingClientRect();
      button.style.setProperty('--mx', `${(event.clientX - box.left - box.width / 2) * .25}px`);
      button.style.setProperty('--my', `${(event.clientY - box.top - box.height / 2) * .35}px`);
    });
    button.addEventListener('pointerleave', () => {
      button.style.setProperty('--mx', '0px');
      button.style.setProperty('--my', '0px');
    });
  }

  // 画面に入った要素を順に表示する
  const revealTargets = document.querySelectorAll('.section-heading, [data-reveal]');
  const columns = () => getComputedStyle(document.querySelector('.case-grid') || root).gridTemplateColumns.split(' ').length || 1;
  const observer = new IntersectionObserver(entries => {
    let order = 0;
    const perRow = columns();
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const index = [...entry.target.parentElement.children].indexOf(entry.target);
      entry.target.style.setProperty('--delay', `${(index % perRow) * .08 + order++ * .02}s`);
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const target of revealTargets) observer.observe(target);

  // 文字が組み上がって見える表示
  const glyphs = 'アイウエオカキクケコサシスセソ01<>/=+*#_';
  for (const element of document.querySelectorAll('[data-scramble]')) {
    if (!moving()) continue;
    const text = element.textContent;
    const started = performance.now();
    const duration = 900;
    const step = now => {
      const progress = Math.min((now - started) / duration, 1);
      const settled = Math.floor(progress * text.length);
      let output = text.slice(0, settled);
      for (let i = settled; i < text.length; i++) output += text[i] === '・' ? '・' : glyphs[(Math.random() * glyphs.length) | 0];
      element.textContent = output;
      if (progress < 1) requestAnimationFrame(step);
      else element.textContent = text;
    };
    requestAnimationFrame(step);
  }
})();
