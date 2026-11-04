import { storage } from '#imports';

/** 文章外观：博客、代码编辑器、电子表格、在线文档、终端日志。 */
export const ARTICLE_STYLES = ['blog', 'code', 'sheet', 'doc', 'terminal'] as const;

export type ArticleStyle = (typeof ARTICLE_STYLES)[number];

/** 各外观对应的默认伪装标题，图标见 public/favicon/<style>.svg。 */
export const STYLE_TITLES: Record<ArticleStyle, string> = {
  blog: '团队技术博客',
  code: 'index.ts — workspace',
  sheet: '工作簿1.xlsx',
  doc: '项目周报 - 在线文档',
  terminal: 'bash — build.log',
};

export function styleFaviconPath(style: ArticleStyle) {
  return `/favicon/${style}.svg` as const;
}

export interface Settings {
  /** 文章模式总开关，控制页面外观与划线隐藏 */
  articleMode: boolean;
  /** 文章外观，仅在文章模式下生效 */
  articleStyle: ArticleStyle;
  /** 隐藏划线、批注和想法气泡，仅在文章模式下生效 */
  hideMarks: boolean;
  /** 是否伪装标签页标题 */
  spoofTitle: boolean;
  /** 自定义伪装标题，留空则使用当前外观的默认标题 */
  spoofTitleText: string;
  /** 是否伪装网站图标 */
  spoofFavicon: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  articleMode: true,
  articleStyle: 'blog',
  hideMarks: true,
  spoofTitle: true,
  spoofTitleText: '',
  spoofFavicon: true,
};

export const settings = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});

const MAX_TITLE_LENGTH = 80;

/** 旧版本的默认标题，视为未自定义。 */
const LEGACY_DEFAULT_TITLE = '工作文档';

/** 压缩空白、截断长度。 */
export function normalizeTitle(text: string): string {
  const title = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
  return title === LEGACY_DEFAULT_TITLE ? '' : title;
}

/** 实际使用的伪装标题：自定义标题优先，否则跟随外观。 */
export function resolveTitle(value: Settings): string {
  return normalizeTitle(value.spoofTitleText) || STYLE_TITLES[value.articleStyle];
}

/** 逐字段合并默认值，兼容旧版本或损坏的存储数据。 */
export function normalizeSettings(
  value: Partial<Settings> | null | undefined,
): Settings {
  return {
    articleMode: value?.articleMode !== false,
    articleStyle: ARTICLE_STYLES.includes(value?.articleStyle as ArticleStyle)
      ? (value!.articleStyle as ArticleStyle)
      : DEFAULT_SETTINGS.articleStyle,
    hideMarks: value?.hideMarks !== false,
    spoofTitle: value?.spoofTitle !== false,
    spoofTitleText: normalizeTitle(
      typeof value?.spoofTitleText === 'string'
        ? value.spoofTitleText
        : DEFAULT_SETTINGS.spoofTitleText,
    ),
    spoofFavicon: value?.spoofFavicon !== false,
  };
}

/** 只对微信读书的阅读页生效，书架等页面不改动。 */
export function isReaderUrl(url: string): boolean {
  try {
    const { origin, pathname } = new URL(url);
    return origin === 'https://weread.qq.com' && pathname.startsWith('/web/reader/');
  } catch {
    return false;
  }
}
