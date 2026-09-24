import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

export default function (config) {
  config.addGlobalData('cases', () => JSON.parse(readFileSync('data/cases.json', 'utf8')));
  config.addPassthroughCopy('assets');
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
