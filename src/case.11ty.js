import { layout, escape as e } from './layout.js';

export default class {
  data() { return { pagination: { data: 'cases', size: 1, alias: 'item' }, permalink: data => `/cases/${data.item.id}/index.html` }; }
  render({ item }) {
    return layout(item.title, item.summary, `<article class="frame detail"><a class="back" href="/#works">制作事例の一覧へ</a><header class="detail-heading"><p class="category">${e(item.case_type)} / ${e(item.category)}</p><h1>${e(item.title)}</h1><p>${e(item.summary)}</p></header>
    <div class="detail-body"><div>${item.description ? `<section><h2>概要</h2><p>${e(item.description)}</p></section>` : ''}${item.purpose ? `<section><h2>制作の目的</h2><p>${e(item.purpose)}</p></section>` : ''}${item.highlights?.length ? `<section><h2>機能と特徴</h2><ul>${item.highlights.map(text => `<li>${e(text)}</li>`).join('')}</ul></section>` : ''}</div><aside><h2>使用技術</h2><ul class="tech">${(item.tech_stack || []).map(text => `<li>${e(text)}</li>`).join('')}</ul>${item.links.length ? `<h2>公開先</h2><ul class="links">${item.links.map(link => `<li><a href="${e(link.url)}">${e(link.label)} <span aria-hidden="true">↗</span></a></li>`).join('')}</ul>` : ''}</aside></div>
    ${item.screenshots.length ? `<section class="screens"><h2>画面</h2>${item.screenshots.map((src, i) => `<img src="/${e(src)}" alt="${e(item.title)}の画面${i + 1}" loading="lazy" width="1440" height="900">`).join('')}</section>` : ''}</article>`);
  }
}
