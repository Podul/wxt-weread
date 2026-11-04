import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: '文档助手',
    description: '改善网页阅读排版与显示',
    permissions: ['storage'],
    action: {
      default_title: '文档助手',
    },
    web_accessible_resources: [
      {
        resources: ['doc-icon.svg'],
        matches: ['https://weread.qq.com/*'],
      },
    ],
  },
});
