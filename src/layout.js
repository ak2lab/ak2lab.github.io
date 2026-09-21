export function escape(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
}

export function layout(title, description, content) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | AK²Lab</title><meta name="description" content="${escape(description)}"><link rel="icon" href="/assets/logo.png"><link rel="stylesheet" href="/assets/site.css"><script src="/assets/motion.js" defer></script></head><body>
  <a class="skip" href="#main">本文へ移動</a>
  <header class="header frame"><a class="brand" href="/"><img src="/assets/logo.png" alt="" width="48" height="48"><span>AK²Lab</span></a><nav aria-label="主なページ"><a href="/#works">制作事例</a><a href="https://github.com/ak2lab">GitHub</a><a href="https://ak2lab.com/">公式サイト</a></nav></header>
  <main id="main">${content}</main>
  <footer class="frame footer"><a class="brand" href="/">AK²Lab</a><nav aria-label="関連サイト"><a href="https://ak2lab.com/">公式サイト</a><a href="https://github.com/ak2lab">GitHub</a><a href="https://x.com/aidev_ak">X</a></nav><p>自主制作・公開デモを含む制作事例と技術資料を紹介しています。</p></footer></body></html>`;
}
