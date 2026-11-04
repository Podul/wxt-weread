import {
  CHAPTER_EVENT,
  CHAPTER_FRAGMENT_ID,
  CHAPTER_REQUEST_EVENT,
  PROGRESS_EVENT,
} from '../utils/chapter-bridge';

/**
 * 运行在页面主世界，截获读书解析章节时的完整 HTML 和阅读进度上报。
 *
 * 读书正文画在 canvas 上，DOM 里只有可视区域、乱序的逐字 span；
 * 但每次进入章节，读书都会把整章预处理后的 HTML 交给 DOMParser，
 * 这里只读取入参转发给内容脚本，不改变解析结果和请求。
 */
export default defineContentScript({
  matches: ['https://weread.qq.com/web/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const original = DOMParser.prototype.parseFromString;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const progressRequests = new WeakSet<XMLHttpRequest>();

    // 跨 world 的事件 detail 只能可靠传递原始值，统一序列化成 JSON 字符串。
    let lastChapter: string | null = null;
    let lastProgress: string | null = null;
    // 长章节会被拆成多段（读书按段翻「下一页」），在同一轮同步调用里依次解析，攒齐后一起转发。
    let parts: string[] | null = null;

    function dispatch(type: string, detail: string | null) {
      if (detail === null) return;
      try {
        document.dispatchEvent(new CustomEvent(type, { detail }));
      } catch {
        // 转发失败不能影响读书自身渲染。
      }
    }

    function emit() {
      dispatch(CHAPTER_EVENT, lastChapter);
      dispatch(PROGRESS_EVENT, lastProgress);
    }

    DOMParser.prototype.parseFromString = function (
      this: DOMParser,
      source: string,
      type: DOMParserSupportedType,
    ) {
      const result = original.call(this, source, type);
      if (typeof source === 'string' && source.includes(CHAPTER_FRAGMENT_ID)) {
        if (!parts) {
          const batch: string[] = (parts = []);
          queueMicrotask(() => {
            parts = null;
            lastChapter = JSON.stringify(batch);
            // 旧章节的进度不适用于新章节，等读书上报新进度。
            lastProgress = null;
            dispatch(CHAPTER_EVENT, lastChapter);
          });
        }
        parts.push(source);
      }
      return result;
    };

    // 读书进入章节、翻页时会立即 POST /web/book/read 上报阅读位置，co 为章节内字符偏移。
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      try {
        if (new URL(url, location.href).pathname === '/web/book/read') progressRequests.add(this);
        else progressRequests.delete(this);
      } catch {
        progressRequests.delete(this);
      }
      return (originalOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      if (progressRequests.has(this) && typeof body === 'string') {
        try {
          const co: unknown = JSON.parse(body).co;
          if (typeof co === 'number') {
            lastProgress = String(co);
            dispatch(PROGRESS_EVENT, lastProgress);
          }
        } catch {
          // 无法识别的上报直接忽略。
        }
      }
      return originalSend.call(this, body);
    };

    document.addEventListener(CHAPTER_REQUEST_EVENT, emit);
  },
});
