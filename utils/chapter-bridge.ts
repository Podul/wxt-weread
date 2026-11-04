/** 主世界脚本把截获的章节 HTML 通过该事件发给内容脚本，detail 为各段 HTML 字符串数组的 JSON。 */
export const CHAPTER_EVENT = 'wr-doc:chapter';

/** 主世界脚本截获读书上报的阅读位置后发出该事件，detail 为章节内字符偏移的字符串。 */
export const PROGRESS_EVENT = 'wr-doc:progress';

/** 内容脚本启动或重新加载后用该事件请求重发最近一次的章节 HTML 和阅读位置。 */
export const CHAPTER_REQUEST_EVENT = 'wr-doc:chapter-request';

/** 读书预处理后的章节 HTML 根节点 id，用来识别章节正文。 */
export const CHAPTER_FRAGMENT_ID = 'wr-html-preprocess-fragment';
