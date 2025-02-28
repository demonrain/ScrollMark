import zhCN from "./zh_CN.js";
import en from "./en.js";

export const i18n = {
  zh_CN: zhCN,
  en: en,
};

export function getMessage(key, settings) {
  // 获取当前语言
  const currentLang =
    settings.language === "auto"
      ? navigator.language.startsWith("zh")
        ? "zh_CN"
        : "en"
      : settings.language;

  // 获取对应语言的消息
  const messages = i18n[currentLang] || i18n.en;
  return messages[key] || key;
}
