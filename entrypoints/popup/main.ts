import {
  type ArticleStyle,
  normalizeSettings,
  normalizeTitle,
  settings,
  STYLE_TITLES,
  type Settings,
} from '../../utils/settings';

const articleMode = document.querySelector<HTMLInputElement>('#article-mode')!;
const articleStyle = document.querySelector<HTMLSelectElement>('#article-style')!;
const articleStyleRow = document.querySelector<HTMLElement>('#article-style-row')!;
const hideMarks = document.querySelector<HTMLInputElement>('#hide-marks')!;
const hideMarksRow = document.querySelector<HTMLElement>('#hide-marks-row')!;
const spoofTitle = document.querySelector<HTMLInputElement>('#spoof-title')!;
const titleField = document.querySelector<HTMLElement>('#title-field')!;
const titleInput = document.querySelector<HTMLInputElement>('#spoof-title-text')!;
const spoofFavicon = document.querySelector<HTMLInputElement>('#spoof-favicon')!;

let current: Settings = normalizeSettings(null);
let dirty = false;

function render() {
  articleMode.checked = current.articleMode;
  articleStyle.value = current.articleStyle;
  articleStyle.disabled = !current.articleMode;
  articleStyleRow.classList.toggle('row--disabled', !current.articleMode);
  hideMarks.checked = current.hideMarks;
  hideMarks.disabled = !current.articleMode;
  hideMarksRow.classList.toggle('row--disabled', !current.articleMode);

  spoofTitle.checked = current.spoofTitle;
  titleInput.value = current.spoofTitleText;
  titleInput.placeholder = `${STYLE_TITLES[current.articleStyle]}（跟随外观）`;
  titleInput.disabled = !current.spoofTitle;
  titleField.classList.toggle('field--disabled', !current.spoofTitle);

  spoofFavicon.checked = current.spoofFavicon;
}

async function save(patch: Partial<Settings>) {
  dirty = true;
  current = normalizeSettings({ ...current, ...patch });
  render();
  try {
    await settings.setValue(current);
  } catch (error) {
    console.error('保存设置失败', error);
  }
}

articleMode.addEventListener('change', () => {
  void save({ articleMode: articleMode.checked });
});

articleStyle.addEventListener('change', () => {
  void save({ articleStyle: articleStyle.value as ArticleStyle });
});

hideMarks.addEventListener('change', () => {
  void save({ hideMarks: hideMarks.checked });
});

spoofTitle.addEventListener('change', () => {
  void save({ spoofTitle: spoofTitle.checked });
});

spoofFavicon.addEventListener('change', () => {
  void save({ spoofFavicon: spoofFavicon.checked });
});

titleInput.addEventListener('input', () => {
  dirty = true;
  current = { ...current, spoofTitleText: titleInput.value.slice(0, 80) };
  void settings.setValue(current).catch((error) => {
    console.error('保存设置失败', error);
  });
});

titleInput.addEventListener('change', () => {
  void save({ spoofTitleText: normalizeTitle(titleInput.value) });
});

titleInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    titleInput.blur();
  }
});

void settings.getValue().then((value) => {
  if (dirty) return;
  current = normalizeSettings(value);
  render();
});

render();
