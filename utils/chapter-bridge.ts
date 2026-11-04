/** 主世界脚本把截获的章节 HTML 通过该事件发给内容脚本，detail 为 HTML 字符串。 */
export const CHAPTER_EVENT = 'wr-doc:chapter';

/** 内容脚本启动或重新加载后用该事件请求重发最近一次的章节 HTML。 */
export const CHAPTER_REQUEST_EVENT = 'wr-doc:chapter-request';

/** 读书预处理后的章节 HTML 根节点 id，用来识别章节正文。 */
export const CHAPTER_FRAGMENT_ID = 'wr-html-preprocess-fragment';
