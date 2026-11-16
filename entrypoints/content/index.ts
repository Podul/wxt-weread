import './style.css';

import { browser } from '#imports';

import {
  buildArticle,
  buildPlainTextArticle,
  buildTextArticle,
  type CanvasRow,
} from '../../utils/blog-article';
import {
  CANVAS_RESET_EVENT,
  CANVAS_TEXT_EVENT,
  CHAPTER_EVENT,
  CHAPTER_REQUEST_EVENT,
  PROGRESS_EVENT,
  TEXT_EVENT,
} from '../../utils/chapter-bridge';
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

    // 博客文章：主世界脚本转发的当前章节各段 HTML、阅读位置，以及据此生成的文章节点。
    let chapterParts: string[] | null = null;
    let progress: number | null = null;
    // 网文：读书解码出的完整章节明文（\r\n 分段），优先于 canvas 行。
    let chapterText: string | null = null;
    // 网文：读书逐字绘制在 canvas 上的视觉行，按 y 升序。
    let canvasRows: CanvasRow[] | null = null;
    // 翻章过渡：原正文已恢复绘制但新章还没截获，旧文章先留在原位。
    let canvasPending = false;
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
      try {
        const parts: unknown = JSON.parse(detail);
        if (!Array.isArray(parts) || !parts.length || !parts.every((p) => typeof p === 'string')) return;
        chapterParts = parts;
      } catch {
        return;
      }
      progress = null;
      articleKey = '';
      scheduleArticle();
    });
    ctx.addEventListener(document, PROGRESS_EVENT, (event) => {
      const detail = Number((event as CustomEvent<unknown>).detail);
      if (!Number.isFinite(detail)) return;
      progress = detail;
      scheduleArticle();
    });
    ctx.addEventListener(document, CANVAS_TEXT_EVENT, (event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail !== 'string') return;
      try {
        const rows: unknown = JSON.parse(detail);
        if (!Array.isArray(rows) || !rows.length) return;
        const valid = rows.filter(
          (row): row is [number, string] =>
            Array.isArray(row) && Number.isFinite(row[0]) && typeof row[1] === 'string',
        );
        if (!valid.length) return;
        canvasRows = valid.map(([y, text]) => ({ y, text }));
      } catch {
        return;
      }
      canvasPending = false;
      root.removeAttribute('data-wr-blog-pending');
      articleKey = '';
      scheduleArticle();
    });
    ctx.addEventListener(document, TEXT_EVENT, (event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail !== 'string' || !detail.trim()) return;
      chapterText = detail;
      canvasPending = false;
      root.removeAttribute('data-wr-blog-pending');
      articleKey = '';
      scheduleArticle();
    });

    // 文章模式下 canvas 被收起，读书不会绘制新章；翻章前恢复它的尺寸（保持不可见）并清空上一章的数据。
    const reloadForChapter = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (
        target?.closest?.(
          '.readerFooter_button, .readerHeaderButton, .renderTarget_pager_button',
        )
      ) {
        prepareCanvasChapter();
      }
    };
    document.addEventListener('click', reloadForChapter, true);
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

    /**
     * 新章节的正文需要读书重新绘制。原正文被收起（高度 0）或 visibility:hidden 时读书只画空字符串，
     * 所以翻章时恢复它的尺寸、用 opacity 隐藏并让它脱离布局；旧文章留在原位，新章绘制完再整体替换。
     */
    function prepareCanvasChapter() {
      if (canvasRows === null) return;
      canvasPending = true;
      root.setAttribute('data-wr-blog-pending', '');
      if (article) root.setAttribute('data-wr-blog', '');
      // 同一章重复点击（如首章点「上一章」）时也要清掉可能重绘的旧行。
      document.dispatchEvent(new CustomEvent(CANVAS_RESET_EVENT));
    }

    /** 读书按段翻「下一页」且只显示当前段，取起始字符偏移不超过阅读位置的最后一段。 */
    function currentPartIndex(parts: string[]): number {
      if (progress === null) return 0;
      let index = 0;
      parts.forEach((part, i) => {
        const start = Number(/data-wr-co="(\d+)"/.exec(part)?.[1]);
        if (start <= progress!) index = i;
      });
      return index;
    }

    function syncArticle() {
      if (!ctx.isValid) return;

      if (canvasPending) {
        const pendingHost =
          current.articleMode && isReaderUrl(location.href)
            ? document.querySelector<HTMLElement>('.readerContent .app_content')
            : null;
        if (!pendingHost) {
          canvasPending = false;
          root.removeAttribute('data-wr-blog-pending');
          removeArticle();
          return;
        }
        // 新章还在绘制：旧文章保持原样，新章截获后由下面的分支替换。
        if (article) {
          if (article.parentElement !== pendingHost) pendingHost.append(article);
          root.setAttribute('data-wr-blog', '');
        }
        return;
      }

      const host =
        (chapterParts !== null ||
          chapterText !== null ||
          (canvasRows !== null && canvasRows.length > 0)) &&
        current.articleMode &&
        isReaderUrl(location.href)
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

      if (chapterParts !== null) {
        const part = currentPartIndex(chapterParts);
        const key = JSON.stringify([meta, part, 'html']);
        if (!article || key !== articleKey) {
          const next = buildArticle(chapterParts[part]!, meta, document);
          if (article) article.replaceWith(next);
          article = next;
          articleKey = key;
        }
      } else if (chapterText !== null) {
        const key = JSON.stringify([meta, 'text']);
        if (!article || key !== articleKey) {
          const next = buildPlainTextArticle(chapterText, meta, document);
          if (article) article.replaceWith(next);
          article = next;
          articleKey = key;
        }
      } else if (canvasRows !== null) {
        const key = JSON.stringify([meta, 'canvas']);
        if (!article || key !== articleKey) {
          const next = buildTextArticle(canvasRows, meta, document);
          if (article) article.replaceWith(next);
          article = next;
          articleKey = key;
        }
      }
      if (article && article.parentElement !== host) host.append(article);
      root.setAttribute('data-wr-blog', '');
    }

    ctx.onInvalidated(() => {
      unwatch();
      articleObserver.disconnect();
      document.removeEventListener('click', reloadForChapter, true);
      removeArticle();
      head.dispose();
      root.removeAttribute('data-wr-blog-pending');
      root.removeAttribute('data-wr-article');
      root.removeAttribute('data-wr-style');
      root.removeAttribute('data-wr-hide-marks');
    });
  },
});
