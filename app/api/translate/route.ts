import { NextRequest, NextResponse } from 'next/server';

interface TranslateRequest {
  text: string;
  targetLanguage: string;
  context?: string;
}

interface TranslateResponse {
  success: boolean;
  translatedText?: string;
  error?: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<TranslateResponse>> {
  try {
    const body: TranslateRequest = await request.json();
    const { text, targetLanguage, context } = body;

    // Валидация входных данных
    if (!text || !targetLanguage) {
      return NextResponse.json(
        { success: false, error: 'Текст и язык перевода обязательны' },
        { status: 400 },
      );
    }

    if (text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Текст для перевода не может быть пустым' },
        { status: 400 },
      );
    }

    // Создаем промпт для Ollama
    const prompt = createTranslationPrompt(text, targetLanguage, context);

    // Отправляем запрос к Ollama
    const translatedText = await translateWithOllama(prompt);

    if (!translatedText) {
      return NextResponse.json(
        { success: false, error: 'Не удалось получить перевод от Ollama' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      translatedText: translatedText.trim(),
    });
  } catch (error) {
    console.error('Ошибка при переводе:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Внутренняя ошибка сервера',
      },
      { status: 500 },
    );
  }
}

/**
 * Создает промпт для перевода с учетом контекста
 */
function createTranslationPrompt(
  text: string,
  targetLanguage: string,
  context?: string,
): string {
  const basePrompt = `Переведи текст на ${targetLanguage}. Сохрани HTML-разметку. ВЕРНИ ТОЛЬКО ПЕРЕВОД БЕЗ ОБЪЯСНЕНИЙ И БЕЗ MARKDOWN БЛОКОВ КОДА.`;

  if (context) {
    return `${basePrompt}\n\nКонтекст: ${context}\nТекст: ${text}`;
  }

  return `${basePrompt}\n\nТекст: ${text}`;
}

/**
 * Отправляет запрос к Ollama для перевода
 */
async function translateWithOllama(prompt: string): Promise<string | null> {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'gemma3:latest';

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Низкая температура для более точного перевода
          top_p: 0.9,
          max_tokens: 2000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (data.response) {
      // Очищаем ответ от лишнего текста
      let cleanResponse = data.response.trim();

      // Удаляем markdown блоки кода
      cleanResponse = cleanResponse.replace(/```html\s*/g, '');
      cleanResponse = cleanResponse.replace(/```\s*/g, '');
      cleanResponse = cleanResponse.replace(/```html/g, '');
      cleanResponse = cleanResponse.replace(/```/g, '');

      // Удаляем возможные остатки markdown
      cleanResponse = cleanResponse.replace(/^```.*$/gm, '');
      cleanResponse = cleanResponse.replace(/```html.*$/gm, '');
      cleanResponse = cleanResponse.replace(/```.*$/gm, '');

      // Удаляем возможные префиксы
      const prefixes = [
        'Перевод:',
        'Translation:',
        'Переведенный текст:',
        'Translated text:',
        'Результат перевода:',
        'Translation result:',
        'Вот перевод:',
        'Here is the translation:',
        'Переведено:',
        'Translated:',
      ];

      for (const prefix of prefixes) {
        if (cleanResponse.startsWith(prefix)) {
          cleanResponse = cleanResponse.substring(prefix.length).trim();
        }
      }

      // Удаляем возможные суффиксы и объяснения
      const lines = cleanResponse.split('\n');
      const firstLine = lines[0];

      // Если первая строка содержит только перевод, возвращаем её
      if (
        firstLine &&
        !firstLine.includes('объяснение') &&
        !firstLine.includes('explanation')
      ) {
        return firstLine.trim();
      }

      return cleanResponse.trim();
    }

    return null;
  } catch (error) {
    console.error('Ошибка при обращении к Ollama:', error);
    throw error;
  }
}
