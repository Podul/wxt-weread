export interface ChapterMeta {
  bookTitle: string;
  author: string;
  chapterTitle: string;
}

/** 原样保留的标签，其余标签（span、a、font 等）只保留子节点。 */
const KEEP_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'ul', 'ol', 'li', 'hr', 'br', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'figure', 'figcaption', 'em', 'strong', 'b', 'i', 'sup', 'sub', 'small',
]);

const DROP_TAGS = new Set(['script', 'style', 'link', 'meta', 'title', 'head']);

const ZERO_WIDTH = /[​‌‍﻿]/g;

/** 中文阅读速度，按每分钟字数估算阅读时长。 */
const CHARS_PER_MINUTE = 400;

function squash(text: string): string {
  return text.replace(ZERO_WIDTH, '').replace(/\s+/g, '');
}

/** 把读书逐字包 span 的章节 HTML 还原成干净的文章节点，丢弃所有原有属性。 */
function convert(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode((node.textContent ?? '').replace(ZERO_WIDTH, ''));
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tag = el.localName;
  if (DROP_TAGS.has(tag)) return null;

  if (tag === 'img') {
    // 读书的图片真实地址在 data-src，src 是 1px 占位图。
    const src = el.getAttribute('data-src') || el.getAttribute('src') || '';
    if (!/^https?:\/\//.test(src)) return null;
    const img = doc.createElement('img');
    img.src = src;
    img.alt = el.getAttribute('alt') ?? '';
    img.loading = 'lazy';
    return img;
  }

  const out = KEEP_TAGS.has(tag) ? doc.createElement(tag) : doc.createDocumentFragment();
  for (const child of Array.from(el.childNodes)) {
    const converted = convert(child, doc);
    if (converted) out.appendChild(converted);
  }

  if (out instanceof Element) {
    const className = el.getAttribute('class') ?? '';
    if (/right/i.test(className)) out.setAttribute('data-align', 'right');
    else if (/center/i.test(className)) out.setAttribute('data-align', 'center');
  }

  // 脚注：读书把注释内容放在 data-wr-footernote 上。
  const note = el.getAttribute('data-wr-footernote');
  if (note) {
    const sup = doc.createElement('sup');
    sup.className = 'wr-blog-note';
    sup.title = note;
    sup.textContent = '注';
    out.appendChild(sup);
  }
  return out;
}

/** 去掉正文开头与章节标题重复的标题，标题由文章头部统一展示。 */
function stripLeadingTitles(body: HTMLElement, chapterTitle: string) {
  const title = squash(chapterTitle);
  if (!title) return;

  for (;;) {
    const first = body.querySelector('h1, h2, h3, h4, h5, h6, p, img');
    if (!first || !/^h\d$/.test(first.localName)) return;
    const text = squash(first.textContent ?? '');
    if (!text || !title.includes(text)) return;

    // 连同只剩空壳的父级 div 一起移除。
    let target: Element = first;
    while (
      target.parentElement &&
      target.parentElement !== body &&
      squash(target.parentElement.textContent ?? '') === text
    ) {
      target = target.parentElement;
    }
    target.remove();
  }
}

/** 文章头部与外壳，排版书和网文共用。 */
function buildShell(
  meta: ChapterMeta,
  doc: Document,
  body: HTMLElement,
  charCount: number,
): HTMLElement {
  const minutes = Math.max(1, Math.round(charCount / CHARS_PER_MINUTE));

  const header = doc.createElement('header');
  header.className = 'wr-blog-header';

  if (meta.bookTitle) {
    const kicker = doc.createElement('div');
    kicker.className = 'wr-blog-kicker';
    kicker.textContent = meta.bookTitle;
    header.appendChild(kicker);
  }

  const h1 = doc.createElement('h1');
  h1.className = 'wr-blog-title';
  h1.textContent = meta.chapterTitle || meta.bookTitle;
  header.appendChild(h1);

  const info = doc.createElement('div');
  info.className = 'wr-blog-meta';
  // 纯图片章节（封面、插图页）不显示字数和时长。
  const stats = charCount > 0 ? [`${charCount.toLocaleString()} 字`, `约 ${minutes} 分钟读完`] : [];
  info.textContent = [meta.author, ...stats].filter(Boolean).join(' · ');
  header.appendChild(info);

  const article = doc.createElement('article');
  article.className = 'wr-blog';
  article.append(header, body);
  // 读书在正文容器上拦截选中、复制和右键，文章内的这些事件不交给它处理。
  for (const type of ['mousedown', 'mouseup', 'selectstart', 'copy', 'contextmenu', 'dragstart']) {
    article.addEventListener(type, (event) => event.stopPropagation());
  }
  return article;
}

export function buildArticle(html: string, meta: ChapterMeta, doc: Document): HTMLElement {
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  const body = doc.createElement('div');
  body.className = 'wr-blog-body';
  for (const child of Array.from(parsed.body.childNodes)) {
    const converted = convert(child, doc);
    if (converted) body.appendChild(converted);
  }
  stripLeadingTitles(body, meta.chapterTitle);

  return buildShell(meta, doc, body, squash(body.textContent ?? '').length);
}

export interface CanvasRow {
  y: number;
  text: string;
}

/** 同一段内折行的最小行距；明显更大处是新段。 */
function lineGap(lines: CanvasRow[]): number {
  let min = Infinity;
  for (let i = 1; i < lines.length; i++) {
    const current = lines[i];
    const previous = lines[i - 1];
    if (!current || !previous) continue;
    const gap = Math.round(current.y - previous.y);
    if (gap > 0 && gap < min) min = gap;
  }
  return Number.isFinite(min) ? min : 0;
}

/** 网文完整明文由读书解码章节分片得到，`\r\n` 分隔段落，段首是用于缩进的全角空格。 */
export function buildPlainTextArticle(
  text: string,
  meta: ChapterMeta,
  doc: Document,
): HTMLElement {
  const body = doc.createElement('div');
  body.className = 'wr-blog-body';
  for (const line of text.split(/\r?\n/)) {
    const value = line.replace(ZERO_WIDTH, '').trim();
    if (!value) continue;
    const p = doc.createElement('p');
    p.textContent = value;
    body.appendChild(p);
  }

  return buildShell(meta, doc, body, squash(body.textContent ?? '').length);
}

/** 网文正文由读书逐字绘制在 canvas 上，按视觉行还原成文章段落。 */
export function buildTextArticle(
  rows: CanvasRow[],
  meta: ChapterMeta,
  doc: Document,
): HTMLElement {
  const lines = rows
    .map((row) => ({ y: row.y, text: row.text.replace(ZERO_WIDTH, '') }))
    .filter((row) => row.text.trim());

  const gap = lineGap(lines);
  const paragraphs: string[] = [];
  let current = '';
  let prevY: number | null = null;
  for (const line of lines) {
    const prev = prevY;
    const breaks = prev !== null && gap > 0 && line.y - prev > gap * 1.2;
    if (!current || breaks) {
      if (current) paragraphs.push(current);
      current = line.text;
    } else {
      current += line.text;
    }
    prevY = line.y;
  }
  if (current) paragraphs.push(current);

  const body = doc.createElement('div');
  body.className = 'wr-blog-body';
  for (const text of paragraphs) {
    const p = doc.createElement('p');
    p.textContent = text;
    body.appendChild(p);
  }

  return buildShell(meta, doc, body, squash(paragraphs.join('')).length);
}
