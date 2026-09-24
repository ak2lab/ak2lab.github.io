# AK²Lab 制作事例と技術

Webサイト・Webアプリ・業務システムの制作事例を紹介する静的サイトです。

## ローカルで確認

Node.js 22を使用します。

```sh
npm ci --ignore-scripts
npm run build
python3 scripts/生成HTMLを検査する.py _site
npm start
```

`data/cases.json` と `assets/cases/` が掲載データと画像です。内部メモや開発環境の設定を含めません。事例の内容は `data/cases.json` を直接編集せず、事例ノートから公開用データを生成します。

ページの文章・HTML構造は `src/index.njk` で編集します。通常のHTMLに、事例カードを繰り返すための `{% for %}` と値を差し込む `{{ }}` だけを加えたテンプレートです。見た目は `assets/site.css` で調整します。カードの光・傾き、表示の順番、動きの停止は `assets/site.js` です。

ファーストビューの3Dは `js/hero.js` で、Three.jsを使っています。ビルド時にesbuildがThree.jsと一緒に `_site/assets/hero.js` へまとめます。WebGLが使えない環境や、動きを減らす設定では、SVGのロゴまたは静止した画面を表示します。

ロゴの形は `js/logo.js` だけに持っています。公式サイトのロゴから頂点を読み取り、部品に分けたデータです。ページのSVG（ヘッダー・図面・フッター）と3Dの部品は、どちらもこのデータから作ります。

欧文の書体はGeistとGeist Mono（SIL Open Font License）で、ビルド時に `node_modules` から `_site/assets/fonts/` へライセンス文と一緒に写します。和文は端末の書体を使います。

## 公開

GitHub Pagesの公開元をGitHub Actionsに設定します。mainブランチへの送信で検査・ビルドを行い、成功した `_site` だけを公開します。

## 関連サイト

- [公式サイト](https://ak2lab.com/)
- [GitHub](https://github.com/ak2lab)
- [X](https://x.com/aidev_ak)
