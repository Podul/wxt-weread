/** 主世界脚本把截获的章节 HTML 通过该事件发给内容脚本，detail 为各段 HTML 字符串数组的 JSON。 */
export const CHAPTER_EVENT = 'wr-doc:chapter';

/** 主世界脚本截获读书上报的阅读位置后发出该事件，detail 为章节内字符偏移的字符串。 */
export const PROGRESS_EVENT = 'wr-doc:progress';

/** 内容脚本启动或重新加载后用该事件请求重发最近一次的章节 HTML 和阅读位置。 */
export const CHAPTER_REQUEST_EVENT = 'wr-doc:chapter-request';

/** 读书预处理后的章节 HTML 根节点 id，用来识别章节正文。 */
export const CHAPTER_FRAGMENT_ID = 'wr-html-preprocess-fragment';

/** 主世界脚本从网文 canvas 逐字绘制中还原的章节行，detail 为 `[y, 文本]` 数组的 JSON。 */
export const CANVAS_TEXT_EVENT = 'wr-doc:canvas-text';

/** 主世界脚本从读书解码章节分片时截获的完整明文，detail 为章节文本（`\r\n` 分段）。 */
export const TEXT_EVENT = 'wr-doc:chapter-text';

/** 内容脚本切换章节时请求主世界脚本清空已收集的 canvas 行。 */
export const CANVAS_RESET_EVENT = 'wr-doc:canvas-reset';
