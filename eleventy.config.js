import { readFileSync } from 'node:fs';

export default function (config) {
  config.addGlobalData('cases', () => JSON.parse(readFileSync('data/cases.json', 'utf8')));
  config.addPassthroughCopy('assets');
  return { dir: { input: 'src', output: '_site' }, templateFormats: ['njk'] };
}
