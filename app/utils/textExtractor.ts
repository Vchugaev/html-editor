'use client';

export interface TextNode {
  text: string;
}

export interface ExtractedTexts {
  texts: TextNode[];
  totalCount: number;
  extractedAt: string;
  siteHash: string;
}

/**
 * Рекурсивно извлекает все текстовые узлы из HTML элемента с сохранением HTML-структуры
 */
export function extractAllTexts(element: Element): TextNode[] {
  const texts: TextNode[] = [];

  // Функция для извлечения текста с HTML-тегами
  function extractTextWithHTML(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text && text.length > 0) {
        texts.push({ text });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      // Проверяем, содержит ли элемент только текстовые узлы (без вложенных элементов)
      const hasOnlyTextNodes = Array.from(element.childNodes).every(
        (child) => child.nodeType === Node.TEXT_NODE,
      );

      if (hasOnlyTextNodes) {
        // Если элемент содержит только текст, извлекаем его с тегами
        const text = element.textContent?.trim();
        if (text && text.length > 0) {
          // Создаем временный контейнер для получения HTML
          const tempDiv = document.createElement('div');
          tempDiv.appendChild(element.cloneNode(true));
          const htmlContent = tempDiv.innerHTML;
          texts.push({ text: htmlContent });
        }
      } else {
        // Если есть вложенные элементы, рекурсивно обрабатываем их
        Array.from(element.childNodes).forEach((child) => {
          extractTextWithHTML(child);
        });
      }
    }
  }

  // Обрабатываем все дочерние узлы
  Array.from(element.childNodes).forEach((child) => {
    extractTextWithHTML(child);
  });

  return texts;
}

/**
 * Создает уникальный хеш сайта на основе текстового контента
 */
function createSiteHash(texts: TextNode[]): string {
  // Объединяем все тексты и создаем хеш
  const allTexts = texts
    .map((t) => t.text)
    .join(' ')
    .toLowerCase();

  // Простой хеш на основе содержимого
  let hash = 0;
  for (let i = 0; i < allTexts.length; i++) {
    const char = allTexts.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Конвертируем в 32-битное число
  }

  return Math.abs(hash).toString(36);
}

/**
 * Сохраняет извлеченные тексты в JSON формате
 */
export function saveTextsToJSON(texts: TextNode[]): string {
  const siteHash = createSiteHash(texts);
  const extractedTexts: ExtractedTexts = {
    texts,
    totalCount: texts.length,
    extractedAt: new Date().toISOString(),
    siteHash,
  };

  return JSON.stringify(extractedTexts, null, 2);
}

/**
 * Загружает тексты из JSON
 */
export function loadTextsFromJSON(jsonString: string): ExtractedTexts | null {
  try {
    return JSON.parse(jsonString) as ExtractedTexts;
  } catch (error) {
    console.error('Ошибка при загрузке текстов из JSON:', error);
    return null;
  }
}
