import './style.css';

import { browser } from '#imports';

import { buildArticle } from '../../utils/blog-article';
import { CHAPTER_EVENT, CHAPTER_REQUEST_EVENT } from '../../utils/chapter-bridge';
import { createHeadDisguise } from '../../utils/head-disguise';
import {
  DEFAULT_SETTINGS,
  isReaderUrl,
  normalizeSettings,
  resolveTitle,
  settings,
  styleFaviconPath,
  type Settings,
} from '../../utils/settings';

export default defineContentScript({
  // 微信读书从书架点书进入阅读页是 SPA 跳转，只匹配 /web/reader/* 会漏注入。
  matches: ['https://weread.qq.com/web/*'],
  runAt: 'document_start',
  main(ctx) {
    const root = document.documentElement;
    const head = createHeadDisguise();

    let current: Settings = DEFAULT_SETTINGS;
    let watchFired = false;

    // 博客文章：主世界脚本转发的当前章节 HTML，以及据此生成的文章节点。
    let chapterHtml: string | null = null;
    let article: HTMLElement | null = null;
    let articleKey = '';
    let articleScheduled = false;

    // 同步按默认值应用一次，尽量在首屏绘制前隐藏读书 UI。
    apply(current);

    // 先订阅再读取，避免初始读取与 watch 的竞态。
    const unwatch = settings.watch((value) => {
      watchFired = true;
      current = normalizeSettings(value);
      apply(current);
    });

    void settings.getValue().then((value) => {
      if (!watchFired && ctx.isValid) {
        current = normalizeSettings(value);
        apply(current);
      }
    });

    ctx.addEventListener(document, CHAPTER_EVENT, (event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail !== 'string') return;
      chapterHtml = detail;
      articleKey = '';
      scheduleArticle();
    });
    // 内容脚本可能晚于首次截获（如扩展重新加载），主动请求重发一次。
    document.dispatchEvent(new CustomEvent(CHAPTER_REQUEST_EVENT));

    // 读书切章时会重建部分 DOM、稍后才更新顶栏章节名，统一在变更后检查文章是否需要重建或重新挂载。
    const articleObserver = new MutationObserver(scheduleArticle);
    articleObserver.observe(root, { childList: true, subtree: true, characterData: true });

    ctx.addEventListener(window, 'wxt:locationchange', () => {
      apply(current);
    });

    // wxt:locationchange 的兜底，每秒只做一次字符串比较。
    let lastHref = location.href;
    ctx.setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        apply(current);
      }
    }, 1000);

    function apply(next: Settings) {
      if (!ctx.isValid) return;

      const onReader = isReaderUrl(location.href);
      root.toggleAttribute('data-wr-article', onReader && next.articleMode);
      if (onReader && next.articleMode) root.setAttribute('data-wr-style', next.articleStyle);
      else root.removeAttribute('data-wr-style');
      root.toggleAttribute(
        'data-wr-hide-marks',
        onReader && next.articleMode && next.hideMarks,
      );
      head.update({
        title: onReader && next.spoofTitle ? resolveTitle(next) : null,
        favicon:
          onReader && next.spoofFavicon
            ? browser.runtime.getURL(styleFaviconPath(next.articleStyle))
            : null,
      });
      scheduleArticle();
    }

    function scheduleArticle() {
      if (articleScheduled) return;
      articleScheduled = true;
      requestAnimationFrame(() => {
        articleScheduled = false;
        syncArticle();
      });
    }

    function removeArticle() {
      article?.remove();
      article = null;
      articleKey = '';
      root.removeAttribute('data-wr-blog');
    }

    function syncArticle() {
      if (!ctx.isValid) return;

      const host =
        chapterHtml !== null && current.articleMode && isReaderUrl(location.href)
          ? document.querySelector<HTMLElement>('.readerContent .app_content')
          : null;
      if (!host) {
        // 原正文收起期间读书不会绘制它的 canvas，事后也不补画，关闭文章模式时刷新才能恢复原版正文。
        if (article && !current.articleMode) {
          location.reload();
          return;
        }
        removeArticle();
        return;
      }

      const text = (selector: string) =>
        document.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const meta = {
        bookTitle: text('.readerTopBar_title_link'),
        author: text('.readerCatalog_bookInfo_author'),
        chapterTitle: text('.readerTopBar_title_chapter'),
      };
      const key = JSON.stringify(meta);

      if (!article || key !== articleKey) {
        const next = buildArticle(chapterHtml!, meta, document);
        if (article) article.replaceWith(next);
        article = next;
        articleKey = key;
      }
      if (article.parentElement !== host) host.append(article);
      root.setAttribute('data-wr-blog', '');    }

    ctx.onInvalidated(() => {
      unwatch();
      articleObserver.disconnect();
      removeArticle();
      head.dispose();
      root.removeAttribute('data-wr-article');
      root.removeAttribute('data-wr-style');
      root.removeAttribute('data-wr-hide-marks');
    });
  },
});
