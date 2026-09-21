"""静的生成物の内部リンク・画像と基本構造を検査する。"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.ids = set()
        self.h1 = 0
        self.main = 0
        self.errors = []

    def handle_starttag(self, tag, values):
        attrs = dict(values)
        self.h1 += tag == 'h1'
        self.main += tag == 'main'
        if 'id' in attrs:
            if attrs['id'] in self.ids: self.errors.append('idが重複')
            self.ids.add(attrs['id'])
        if tag == 'img' and 'alt' not in attrs: self.errors.append('画像の代替文がない')
        if tag in {'a', 'link'} and 'href' in attrs: self.refs.append(attrs['href'])
        if tag in {'img', 'script'} and 'src' in attrs: self.refs.append(attrs['src'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    root = parser.parse_args().root.resolve()
    pages = {}
    for path in root.rglob('*.html'):
        page = Page()
        page.feed(path.read_text(encoding='utf-8'))
        assert page.h1 == 1 and page.main == 1 and not page.errors, f'構造を確認: {path}'
        pages[path.resolve()] = page
    assert pages, 'HTMLがありません'
    for path, page in pages.items():
        for ref in page.refs:
            url = urlsplit(ref)
            if url.scheme or url.netloc: continue
            target = root / unquote(url.path).lstrip('/') if url.path.startswith('/') else path.parent / unquote(url.path)
            if not url.path: target = path
            if target.is_dir(): target /= 'index.html'
            target = target.resolve()
            assert target.is_relative_to(root) and target.is_file(), f'参照先がない: {path.name}: {ref}'
            if url.fragment: assert target in pages and unquote(url.fragment) in pages[target].ids, f'移動先がない: {ref}'
    print(f'生成HTMLの構造・内部リンク・画像参照の検査成功: {len(pages)}ページ')


if __name__ == '__main__': main()
