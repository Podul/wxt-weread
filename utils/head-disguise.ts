type FaviconOriginal = {
  href: string | null;
  type: string | null;
};

export interface HeadDisguise {
  update(options: { title: string | null; favicon: string | null }): void;
  dispose(): void;
}

const FAVICON_SELECTOR = 'link[rel~="icon" i]';

const OBSERVE_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['href', 'rel'],
};

/**
 * 统一管理 <head> 内的标题与 favicon 伪装。
 *
 * 只改写 document.title 和现有 icon link 的属性，不 patch 页面 setter，
 * 也不使用定时器反复抢写；MutationObserver 负责在站点改回标题/图标时收敛。
 */
export function createHeadDisguise(): HeadDisguise {
  const originalIcons = new Map<HTMLLinkElement, FaviconOriginal>();

  let titleDesired: string | null = null;
  let titleOriginal = '';
  let lastSiteTitle = '';
  let lastWrittenTitle = '';

  let iconUrl: string | null = null;
  let addedIcon: HTMLLinkElement | null = null;

  let headObserver: MutationObserver | null = null;
  let bootstrapObserver: MutationObserver | null = null;
  let pending = false;

  function startObserver() {
    if (headObserver || bootstrapObserver) return;

    if (document.head) {
      headObserver = new MutationObserver(scheduleSync);
      headObserver.observe(document.head, OBSERVE_OPTIONS);
      return;
    }

    // document_start 时 <head> 可能尚未解析出来，先等它出现。
    bootstrapObserver = new MutationObserver(() => {
      if (!document.head) return;
      bootstrapObserver?.disconnect();
      bootstrapObserver = null;
      startObserver();
      scheduleSync();
    });
    bootstrapObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopObserver() {
    bootstrapObserver?.disconnect();
    bootstrapObserver = null;
    headObserver?.disconnect();
    headObserver = null;
  }

  function scheduleSync() {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      sync();
    });
  }

  function sync() {
    if (!document.head) return;
    syncTitle();
    syncFavicon();
  }

  function syncTitle() {
    if (titleDesired === null) return;

    const current = document.title;
    if (current === titleDesired) {
      lastWrittenTitle = titleDesired;
      return;
    }

    // 当前值不是本扩展上次写入的值，说明站点刚刚改过标题，记录下来供恢复使用。
    if (current !== lastWrittenTitle) {
      lastSiteTitle = current;
    }

    lastWrittenTitle = titleDesired;
    document.title = titleDesired;
  }

  function enableTitle(title: string) {
    if (titleDesired === null) {
      titleOriginal = document.title;
      lastSiteTitle = titleOriginal;
      lastWrittenTitle = '';
    }
    titleDesired = title;
  }

  function disableTitle() {
    if (titleDesired === null) return;

    const fake = titleDesired;
    titleDesired = null;
    lastWrittenTitle = '';

    if (document.title === fake) {
      document.title = lastSiteTitle || titleOriginal;
    }
  }

  function syncFavicon() {
    if (iconUrl === null || !document.head) return;

    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>(FAVICON_SELECTOR),
    ).filter((link) => link !== addedIcon);

    if (links.length === 0) {
      if (!addedIcon?.isConnected) {
        addedIcon = document.createElement('link');
        addedIcon.rel = 'icon';
        addedIcon.setAttribute('data-wr-fake-icon', '');
        document.head.append(addedIcon);
      }
      if (addedIcon.getAttribute('href') !== iconUrl) {
        addedIcon.setAttribute('href', iconUrl);
      }
      return;
    }

    for (const link of links) {
      if (!originalIcons.has(link)) {
        originalIcons.set(link, {
          href: link.getAttribute('href'),
          type: link.getAttribute('type'),
        });
      }
      if (link.getAttribute('href') !== iconUrl) {
        link.setAttribute('href', iconUrl);
      }
      // 原 link 可能声明 image/x-icon，去掉后让 Chrome 按扩展资源处理。
      if (link.hasAttribute('type')) {
        link.removeAttribute('type');
      }
    }
  }

  function restoreFavicon() {
    iconUrl = null;

    for (const [link, original] of originalIcons) {
      if (!link.isConnected) continue;
      if (original.href === null) link.removeAttribute('href');
      else link.setAttribute('href', original.href);
      if (original.type === null) link.removeAttribute('type');
      else link.setAttribute('type', original.type);
    }
    originalIcons.clear();

    addedIcon?.remove();
    addedIcon = null;
  }

  function update({ title, favicon }: { title: string | null; favicon: string | null }) {
    if (title === null) {
      disableTitle();
    } else {
      enableTitle(title);
    }

    if (favicon === null) {
      restoreFavicon();
    } else {
      iconUrl = favicon;
    }

    if (titleDesired !== null || iconUrl !== null) {
      startObserver();
      scheduleSync();
    } else {
      stopObserver();
    }
  }

  function dispose() {
    disableTitle();
    restoreFavicon();
    stopObserver();
  }

  return { update, dispose };
}
