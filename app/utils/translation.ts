'use client';

import { TextNode } from './textExtractor';
import { Language } from '../types/editor';

export interface TranslationResult {
  success: boolean;
  translatedTexts?: TextNode[];
  error?: string;
  details?: string;
}

export interface TranslationOptions {
  targetLanguage: string;
  sourceLanguage?: string;
  preserveFormatting?: boolean;
}

/**
 * Переводит один элемент через API
 */
export async function translateElement(
  text: string,
  targetLanguage: string,
  context?: string,
): Promise<{ success: boolean; translatedText?: string; error?: string }> {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        targetLanguage,
        context,
      }),
    });

    const data = await response.json();

    if (data.success && data.translatedText) {
      return {
        success: true,
        translatedText: data.translatedText,
      };
    } else {
      return {
        success: false,
        error: data.error || 'Ошибка при переводе',
      };
    }
  } catch (error) {
    console.error('Ошибка при переводе элемента:', error);
    return {
      success: false,
      error: 'Ошибка соединения с сервером перевода',
    };
  }
}

/**
 * Переводит массив текстов через Ollama API
 */
export async function translateTexts(
  texts: TextNode[],
  options: TranslationOptions,
): Promise<TranslationResult> {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts,
        targetLanguage: options.targetLanguage,
        sourceLanguage: options.sourceLanguage || 'auto',
      }),
    });

    const data = await response.json();

    if (data.success && data.translatedTexts) {
      return {
        success: true,
        translatedTexts: data.translatedTexts,
      };
    } else {
      return {
        success: false,
        error: data.error || 'Ошибка при переводе',
        details: data.details,
      };
    }
  } catch (error) {
    console.error('Ошибка при переводе текстов:', error);
    return {
      success: false,
      error: 'Ошибка соединения с сервером перевода',
      details: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  }
}

/**
 * Получает список доступных языков для перевода
 */
export async function getAvailableLanguages(): Promise<Language[]> {
  try {
    const response = await fetch('/api/translate');
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data.languages;
      }
    }
    return [];
  } catch (error) {
    console.error('Ошибка при загрузке языков:', error);
    return [];
  }
}

/**
 * Применяет переводы к элементам в iframe с поддержкой HTML-тегов
 */
export function applyTranslationsToIframe(
  iframe: HTMLIFrameElement,
  originalTexts: TextNode[],
  translatedTexts: TextNode[],
): void {
  const doc = iframe.contentDocument;
  if (!doc) return;

  // Создаем карту переводов
  const translationMap = new Map<string, string>();
  originalTexts.forEach((original, index) => {
    if (translatedTexts[index]) {
      translationMap.set(original.text.trim(), translatedTexts[index].text);
    }
  });

  // Функция для применения переводов с поддержкой HTML
  function applyTranslationToNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const originalText = textNode.textContent?.trim();
      if (originalText && translationMap.has(originalText)) {
        const translatedText = translationMap.get(originalText);
        if (translatedText) {
          textNode.textContent = translatedText;
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;

      // Проверяем, содержит ли элемент только текстовые узлы
      const hasOnlyTextNodes = Array.from(element.childNodes).every(
        (child) => child.nodeType === Node.TEXT_NODE,
      );

      if (hasOnlyTextNodes) {
        // Если элемент содержит только текст, проверяем его HTML-содержимое
        const htmlContent = element.outerHTML;
        const textContent = element.textContent?.trim();

        if (textContent && translationMap.has(textContent)) {
          const translatedText = translationMap.get(textContent);
          if (translatedText) {
            // Создаем временный контейнер для парсинга HTML
            const tempDiv = doc.createElement('div');
            tempDiv.innerHTML = translatedText;

            // Заменяем содержимое элемента
            element.innerHTML = translatedText;
          }
        }
      } else {
        // Если есть вложенные элементы, рекурсивно обрабатываем их
        Array.from(element.childNodes).forEach((child) => {
          applyTranslationToNode(child);
        });
      }
    }
  }

  // Обрабатываем все дочерние узлы body
  Array.from(doc.body.childNodes).forEach((child) => {
    applyTranslationToNode(child);
  });
}

/**
 * Создает промпт для перевода с учетом контекста
 */
export function createTranslationPrompt(
  texts: TextNode[],
  targetLanguage: string,
  sourceLanguage: string = 'auto',
): string {
  const languageNames: { [key: string]: string } = {
    en: 'английский',
    ru: 'русский',
    es: 'испанский',
    fr: 'французский',
    de: 'немецкий',
    it: 'итальянский',
    pt: 'португальский',
    zh: 'китайский',
    ja: 'японский',
    ko: 'корейский',
    ar: 'арабский',
    hi: 'хинди',
    tr: 'турецкий',
    pl: 'польский',
    nl: 'голландский',
    sv: 'шведский',
    no: 'норвежский',
    da: 'датский',
    fi: 'финский',
    cs: 'чешский',
    hu: 'венгерский',
    ro: 'румынский',
    bg: 'болгарский',
    hr: 'хорватский',
    sk: 'словацкий',
    sl: 'словенский',
    et: 'эстонский',
    lv: 'латвийский',
    lt: 'литовский',
    uk: 'украинский',
    be: 'белорусский',
    ka: 'грузинский',
    hy: 'армянский',
    az: 'азербайджанский',
    kk: 'казахский',
    ky: 'киргизский',
    uz: 'узбекский',
    tg: 'таджикский',
    mn: 'монгольский',
    th: 'тайский',
    vi: 'вьетнамский',
    id: 'индонезийский',
    ms: 'малайский',
    tl: 'филиппинский',
  };

  const targetLanguageName = languageNames[targetLanguage] || targetLanguage;
  const sourceLanguageName =
    sourceLanguage === 'auto'
      ? 'автоматически определенный'
      : languageNames[sourceLanguage] || sourceLanguage;

  // Объединяем все тексты в один запрос для более эффективного перевода
  const combinedText = texts.map((t) => t.text).join('\n---\n');

  return `Переведи следующие тексты с ${sourceLanguageName} на ${targetLanguageName}. 
Сохрани структуру и форматирование. Каждый текст должен быть переведен отдельно.
Верни только переведенные тексты, разделенные тем же разделителем "---".

Тексты для перевода:
${combinedText}`;
}

/**
 * Валидирует результат перевода
 */
export function validateTranslation(
  originalTexts: TextNode[],
  translatedTexts: TextNode[],
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (translatedTexts.length !== originalTexts.length) {
    errors.push(
      `Количество переведенных текстов (${translatedTexts.length}) не соответствует исходному (${originalTexts.length})`,
    );
  }

  // Проверяем, что переведенные тексты не пустые
  const emptyTranslations = translatedTexts.filter((t) => !t.text.trim());
  if (emptyTranslations.length > 0) {
    errors.push(`Найдено ${emptyTranslations.length} пустых переводов`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Создает резервную копию оригинальных текстов
 */
export function createTextBackup(texts: TextNode[]): TextNode[] {
  return texts.map((text) => ({ text: text.text }));
}

/**
 * Восстанавливает оригинальные тексты из резервной копии с поддержкой HTML
 */
export function restoreTextBackup(
  iframe: HTMLIFrameElement,
  originalTexts: TextNode[],
): void {
  const doc = iframe.contentDocument;
  if (!doc) return;

  // Функция для восстановления текстов с поддержкой HTML
  function restoreTextToNode(node: Node, textIndex: number): number {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      if (originalTexts[textIndex]) {
        textNode.textContent = originalTexts[textIndex].text;
        return textIndex + 1;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;

      // Проверяем, содержит ли элемент только текстовые узлы
      const hasOnlyTextNodes = Array.from(element.childNodes).every(
        (child) => child.nodeType === Node.TEXT_NODE,
      );

      if (hasOnlyTextNodes && originalTexts[textIndex]) {
        // Если элемент содержит только текст, восстанавливаем его HTML
        element.innerHTML = originalTexts[textIndex].text;
        return textIndex + 1;
      } else {
        // Если есть вложенные элементы, рекурсивно обрабатываем их
        let currentIndex = textIndex;
        Array.from(element.childNodes).forEach((child) => {
          currentIndex = restoreTextToNode(child, currentIndex);
        });
        return currentIndex;
      }
    }
    return textIndex;
  }

  // Восстанавливаем тексты, начиная с первого узла
  let currentIndex = 0;
  Array.from(doc.body.childNodes).forEach((child) => {
    currentIndex = restoreTextToNode(child, currentIndex);
  });
}
