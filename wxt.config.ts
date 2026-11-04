import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: '书衣',
    description: '改善网页阅读排版与显示',
    permissions: ['storage'],
    action: {
      default_title: '书衣',
    },
    web_accessible_resources: [
      {
        resources: ['doc-icon.svg'],
        matches: ['https://weread.qq.com/*'],
      },
    ],
  },
});
