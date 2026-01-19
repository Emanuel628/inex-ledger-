const fs = require('fs');
const path = 'js/register.js';
let text = fs.readFileSync(path, 'utf8');
const start = text.indexOf('function populateLanguageOptions() {');
const end = text.indexOf('function persistRegionAndLanguage()', start);
const replacement = `function populateLanguageOptions() {
  if (!languageSelect) return;

  const labels =
    window.LUNA_LANGUAGE_LABELS ||
    {
      en: 'English',
      es: 'Español',
      fr: 'Français'
    };
  const languages =
    window.LUNA_I18N?.LANGUAGES ||
    Object.keys(labels);
  const savedLanguage = window.LUNA_LANGUAGE || 'en';

  languageSelect.innerHTML = '';
  languages.forEach((code) => {
    if (!labels[code]) return;
    const option = document.createElement('option');
    option.value = code;
    option.textContent = labels[code];
    if (code === savedLanguage) {
      option.selected = true;
    }
    languageSelect.appendChild(option);
  });
}

`;
text = text.slice(0, start) + replacement + text.slice(end);
fs.writeFileSync(path, text);
