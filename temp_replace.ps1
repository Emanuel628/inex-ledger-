 = Get-Content js/register.js -Raw
 = 'function populateLanguageOptions\(\)\s*\{[\s\S]*?\}\s*'
 = @'
function populateLanguageOptions() {
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
'@
 = [regex]::Replace(, , , 1)
Set-Content js/register.js 
