import { layout, escape as e } from './layout.js';

export default class {
  render({ cases }) {
    return layout('制作事例と技術', 'AK²LabのWebサイト・Webアプリ・業務システムの制作事例と技術資料。', `
    <section class="hero frame"><div class="hero-copy"><p class="intro">Webサイト・Webアプリ・業務システム</p><h1>画面から仕組みまで<br>作って、確かめる</h1><p>使う人の画面と、その奥で動く仕組み。AK²Labが制作したWebサイトやアプリを、技術と設計の視点から紹介します。</p><a class="primary" href="#works">制作事例を見る <span aria-hidden="true">→</span></a></div><div class="hero-art"><canvas aria-hidden="true"></canvas><img src="/assets/logo.png" alt="" width="512" height="512"><button class="motion-toggle" type="button" hidden>動きを止める</button></div></section>
    <section class="frame works" id="works"><div class="section-heading"><h2>制作事例</h2><p>目的、使用技術、制作で考えたこと。</p></div><div class="case-grid">${cases.map(item => `<article class="case"><a href="/cases/${e(item.id)}/">${item.screenshots[0] ? `<div class="case-image"><img src="/${e(item.screenshots[0])}" alt="${e(item.title)}の画面" loading="lazy" width="1440" height="900"></div>` : ''}<p class="category">${e(item.category)}</p><h3>${e(item.title)} <span aria-hidden="true">→</span></h3></a><p>${e(item.summary)}</p></article>`).join('')}</div></section>`);
  }
}
