import {
  CHAPTER_EVENT,
  CHAPTER_FRAGMENT_ID,
  CHAPTER_REQUEST_EVENT,
} from '../utils/chapter-bridge';

/**
 * 运行在页面主世界，截获读书解析章节时的完整 HTML。
 *
 * 读书正文画在 canvas 上，DOM 里只有可视区域、乱序的逐字 span；
 * 但每次进入章节，读书都会把整章预处理后的 HTML 交给 DOMParser，
 * 这里只读取入参转发给内容脚本，不改变解析结果。
 */
export default defineContentScript({
  matches: ['https://weread.qq.com/web/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const original = DOMParser.prototype.parseFromString;
    let last: string | null = null;

    function emit() {
      if (last !== null) {
        document.dispatchEvent(new CustomEvent(CHAPTER_EVENT, { detail: last }));
      }
    }

    DOMParser.prototype.parseFromString = function (
      this: DOMParser,
      source: string,
      type: DOMParserSupportedType,
    ) {
      const result = original.call(this, source, type);
      if (typeof source === 'string' && source.includes(CHAPTER_FRAGMENT_ID)) {
        last = source;
        try {
          emit();
        } catch {
          // 转发失败不能影响读书自身渲染。
        }
      }
      return result;
    };

    document.addEventListener(CHAPTER_REQUEST_EVENT, emit);
  },
});
