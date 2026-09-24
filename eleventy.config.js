import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { LOGO_OUTLINE, LOGO_PARTS, LOGO_VIEWBOX, pathData } from './js/logo.js';

const fonts = 'node_modules/@fontsource-variable';

export default function (config) {
  config.addGlobalData('cases', () => JSON.parse(readFileSync('data/cases.json', 'utf8')));
  // ロゴの形はjs/logo.jsだけに持ち、SVGと3Dで共有する
  config.addGlobalData('logo', {
    viewBox: LOGO_VIEWBOX.join(' '),
    parts: LOGO_PARTS.map(part => pathData(part.points)),
    outline: LOGO_OUTLINE.map(pathData).join(''),
  });
  config.addPassthroughCopy('assets');
  // 欧文の書体（SIL Open Font License）。ライセンス文も一緒に配信する
  config.addPassthroughCopy({
    [`${fonts}/geist/files/geist-latin-wght-normal.woff2`]: 'assets/fonts/geist.woff2',
    [`${fonts}/geist-mono/files/geist-mono-latin-wght-normal.woff2`]: 'assets/fonts/geist-mono.woff2',
    [`${fonts}/geist/LICENSE`]: 'assets/fonts/LICENSE-geist.txt',
    [`${fonts}/geist-mono/LICENSE`]: 'assets/fonts/LICENSE-geist-mono.txt',
  });
  // ファーストビューの3DはThree.jsと一緒に1ファイルへまとめて配信する
  config.on('eleventy.after', () => build({
    entryPoints: ['js/hero.js'],
    outfile: '_site/assets/hero.js',
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    legalComments: 'eof',
  }));
  config.addWatchTarget('js/');
  return { dir: { input: 'src', output: '_site' }, templateFormats: ['njk'] };
}
