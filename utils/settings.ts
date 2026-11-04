import { storage } from '#imports';

export interface Settings {
  /** 文章模式总开关，控制页面外观与划线隐藏 */
  articleMode: boolean;
  /** 隐藏划线、批注和想法气泡，仅在文章模式下生效 */
  hideMarks: boolean;
  /** 是否伪装标签页标题 */
  spoofTitle: boolean;
  /** 伪装后的标签页标题文本 */
  spoofTitleText: string;
  /** 是否伪装网站图标 */
  spoofFavicon: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  articleMode: true,
  hideMarks: true,
  spoofTitle: true,
  spoofTitleText: '工作文档',
  spoofFavicon: true,
};

export const settings = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});

const MAX_TITLE_LENGTH = 80;

/** 压缩空白、截断长度，空值回退默认标题。 */
export function normalizeTitle(text: string): string {
  return (
    text.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH) ||
    DEFAULT_SETTINGS.spoofTitleText
  );
}

/** 逐字段合并默认值，兼容旧版本或损坏的存储数据。 */
export function normalizeSettings(
  value: Partial<Settings> | null | undefined,
): Settings {
  return {
    articleMode: value?.articleMode !== false,
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
