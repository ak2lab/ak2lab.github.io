// ページ全体の動き。3Dはhero.jsが受け持ち、動きの停止の状態だけを共有する
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const moving = () => root.dataset.motion !== 'off' && !reduced.matches;

  // 動きの停止。選んだ状態は次に開いたときも使う
  const toggle = document.querySelector('[data-motion-toggle]');
  const stored = () => { try { return localStorage.getItem('motion'); } catch { return null; } };
  const store = value => { try { localStorage.setItem('motion', value); } catch { /* 保存できない環境では記憶しない */ } };
  function applyMotion(value) {
    root.dataset.motion = value;
    if (toggle) {
      toggle.textContent = value === 'off' ? '動きを再開する' : '動きを止める';
      toggle.hidden = reduced.matches;
    }
    document.dispatchEvent(new CustomEvent('motionchange'));
  }
  applyMotion(stored() === 'off' ? 'off' : 'on');
  toggle?.addEventListener('click', () => {
    const next = root.dataset.motion === 'off' ? 'on' : 'off';
    store(next);
    applyMotion(next);
  });
  reduced.addEventListener('change', () => applyMotion(root.dataset.motion));

  // ヘッダーは少しでもスクロールしたら背景を付ける。ページ先頭に置いた目印の見え方で判断する
  const header = document.querySelector('[data-header]');
  if (header) {
    const marker = document.createElement('div');
    marker.setAttribute('aria-hidden', 'true');
    marker.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none';
    document.body.prepend(marker);
    new IntersectionObserver(([entry]) => header.classList.toggle('is-scrolled', !entry.isIntersecting)).observe(marker);
  }

  // ポインターの位置に置く光。更新は1フレームに1回、transformだけを書き換える
  const light = document.querySelector('.pointer-light');
  let lightFrame = 0, lightX = 0, lightY = 0;
  addEventListener('pointermove', event => {
    if (!light || !finePointer.matches) return;
    lightX = event.clientX;
    lightY = event.clientY;
    if (lightFrame) return;
    lightFrame = requestAnimationFrame(() => {
      lightFrame = 0;
      light.style.transform = `translate3d(${lightX}px, ${lightY}px, 0)`;
      light.classList.add('is-on');
    });
  }, { passive: true });
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) light?.classList.remove('is-on'); });

  // カードの光と傾き。大きさは入ったときに一度だけ測る
  function follow(element, tilt) {
    let box = null, frame = 0, x = 0, y = 0;
    element.addEventListener('pointerenter', () => {
      const rect = element.getBoundingClientRect();
      box = { left: rect.left + scrollX, top: rect.top + scrollY, width: rect.width, height: rect.height };
    });
    element.addEventListener('pointermove', event => {
      if (!box || !finePointer.matches) return;
      x = event.pageX;
      y = event.pageY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const gx = x - box.left, gy = y - box.top;
        element.style.setProperty('--gx', `${gx}px`);
        element.style.setProperty('--gy', `${gy}px`);
        if (tilt && moving()) {
          const u = gx / box.width - 0.5, v = gy / box.height - 0.5;
          element.style.transform = `perspective(1100px) rotateX(${(-v * 5).toFixed(2)}deg) rotateY(${(u * 5).toFixed(2)}deg)`;
        }
      });
    });
    element.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      frame = 0;
      box = null;
      element.style.transform = '';
    });
  }
  document.querySelectorAll('[data-case]').forEach(card => follow(card, true));
  document.querySelectorAll('[data-glow]').forEach(link => follow(link, false));

  // 主ボタンはポインターへ少し寄る
  for (const button of document.querySelectorAll('[data-magnetic]')) {
    let box = null;
    button.addEventListener('pointerenter', () => { box = button.getBoundingClientRect(); });
    button.addEventListener('pointermove', event => {
      if (!box || !finePointer.matches || !moving()) return;
      const dx = event.clientX - (box.left + box.width / 2), dy = event.clientY - (box.top + box.height / 2);
      button.style.transform = `translate(${(dx * 0.18).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px)`;
    });
    button.addEventListener('pointerleave', () => {
      box = null;
      button.style.transform = '';
    });
  }

  // 画面に入った要素を表示する。カードは列ごとに少しずつ遅らせる
  const grid = document.querySelector('.case-grid');
  const observer = new IntersectionObserver(entries => {
    const columns = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 1;
    let order = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const target = entry.target;
      const column = target.parentElement === grid ? [...grid.children].indexOf(target) % columns : order;
      target.style.setProperty('--delay', `${(column * 0.08 + order * 0.02).toFixed(2)}s`);
      target.classList.add('is-visible');
      observer.unobserve(target);
      order++;
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach(element => observer.observe(element));

  // 見出しの上の一行は、文字が順に点く。読み上げには元の文を渡す
  const intro = document.querySelector('[data-type]');
  if (intro && moving()) {
    const text = intro.textContent.trim();
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = text;
    const letters = document.createElement('span');
    letters.setAttribute('aria-hidden', 'true');
    [...text].forEach((letter, index) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.style.setProperty('--d', index);
      span.textContent = letter;
      letters.append(span);
    });
    intro.replaceChildren(label, letters);
    intro.classList.add('is-typed');
  }
})();
