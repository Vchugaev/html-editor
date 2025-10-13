'use client';

import { VariableItem } from '../types/editor';

/**
 * Извлекает значения переменных из JavaScript-кода в HTML
 * Ищет объявления переменных типа const name = "value"; или let name = "value";
 */
export function extractVariableValuesFromScripts(
  html: string,
): Map<string, string> {
  const valueMap = new Map<string, string>();

  // Паттерн для поиска всех script тегов
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;

  while ((scriptMatch = scriptPattern.exec(html)) !== null) {
    const scriptContent = scriptMatch[1];

    // Извлекаем значения простых переменных
    const simpleVarPattern = /(?:const|let|var)\s+(\w+)\s*=\s*([^;]+);/g;
    let varMatch;

    while ((varMatch = simpleVarPattern.exec(scriptContent)) !== null) {
      const varName = varMatch[1];
      let varValue = varMatch[2].trim();

      // Очищаем значение от кавычек и лишних пробелов
      if (
        (varValue.startsWith('"') && varValue.endsWith('"')) ||
        (varValue.startsWith("'") && varValue.endsWith("'"))
      ) {
        varValue = varValue.slice(1, -1);
      }

      // Обрабатываем шаблонные строки в значениях переменных
      if (varValue.startsWith('`') && varValue.endsWith('`')) {
        const templateContent = varValue.slice(1, -1);
        // Заменяем переменные в шаблоне на их значения
        const variableMatches = templateContent.match(/\$\{([^}]+)\}/g);
        if (variableMatches) {
          let processedValue = templateContent;
          variableMatches.forEach((varMatch) => {
            const varPath = varMatch.replace(/\$\{|\}/g, '');
            const pathParts = varPath
              .split(/[\.\[\]]/)
              .filter((part) => part !== '');
            if (pathParts.length > 0) {
              const rootVar = pathParts[0];
              const rootValue = valueMap.get(rootVar);

              if (rootValue) {
                try {
                  let parsedRoot;
                  try {
                    parsedRoot = JSON.parse(rootValue);
                  } catch {
                    parsedRoot = eval(`(${rootValue})`);
                  }
                  const remainingPath = pathParts.slice(1).join('.');
                  const extractedValue = getValueByPath(
                    parsedRoot,
                    remainingPath,
                  );
                  processedValue = processedValue.replace(
                    varMatch,
                    extractedValue,
                  );
                } catch {
                  // Не удалось обработать
                }
              }
            }
          });
          varValue = processedValue;
        } else {
          // Если нет переменных, просто убираем обратные кавычки
          varValue = templateContent;
        }
      }

      valueMap.set(varName, varValue);
    }

    // Извлекаем значения объектов и массивов
    const objectPattern = /(?:const|let|var)\s+(\w+)\s*=\s*(\{[\s\S]*?\});/g;
    let objMatch;

    while ((objMatch = objectPattern.exec(scriptContent)) !== null) {
      const objName = objMatch[1];
      const objValue = objMatch[2];

      try {
        // Пытаемся распарсить объект
        const parsedObj = eval(`(${objValue})`);
        valueMap.set(objName, JSON.stringify(parsedObj));
      } catch {
        // Если не удалось распарсить, сохраняем как строку
        valueMap.set(objName, objValue);
      }
    }

    // Извлекаем значения массивов
    const arrayPattern = /(?:const|let|var)\s+(\w+)\s*=\s*(\[[\s\S]*?\]);/g;
    let arrMatch;

    while ((arrMatch = arrayPattern.exec(scriptContent)) !== null) {
      const arrName = arrMatch[1];
      const arrValue = arrMatch[2];

      try {
        // Пытаемся распарсить массив
        const parsedArr = eval(`(${arrValue})`);
        valueMap.set(arrName, JSON.stringify(parsedArr));
      } catch {
        // Если не удалось распарсить, сохраняем как строку
        valueMap.set(arrName, arrValue);
      }
    }
  }

  return valueMap;
}

/**
 * Извлекает значение по глубокому пути из объекта
 * Например: getValueByPath(data, "items[0].title") или getValueByPath(user, "profile.email")
 */
export function getValueByPath(
  obj: Record<string, unknown>,
  path: string,
): string {
  if (!obj || !path) return '';

  try {
    // Разбиваем путь на части, учитывая и точки, и скобки
    const parts = path.split(/[\.\[\]]/).filter((part) => part !== '');

    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return '';

      if (Array.isArray(current)) {
        const index = parseInt(part);
        if (!isNaN(index)) {
          current = current[index];
        } else {
          return '';
        }
      } else if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return '';
      }
    }

    return current !== null && current !== undefined ? String(current) : '';
  } catch {
    return '';
  }
}

/**
 * Извлекает переменные из HTML контента
 * Ищет паттерны <script>document.write(variableName);</script> и <script>document.write(`template`);</script>
 * Поддерживает глубокие пути типа ${people[0].name}, ${user.profile.email}
 * Автоматически извлекает значения переменных из JavaScript-кода
 */
export function extractVariablesFromHtml(html: string): VariableItem[] {
  const variables: VariableItem[] = [];

  // Сначала извлекаем все значения переменных из JavaScript-кода
  const valueMap = extractVariableValuesFromScripts(html);

  // Паттерн для простых переменных: document.write(variableName);
  const simplePattern =
    /<script>\s*document\.write\s*\(\s*(\w+)\s*\)\s*;?\s*<\/script>/gi;

  // Паттерн для шаблонных строк: document.write(`template with ${variable}`);
  const templatePattern =
    /<script>\s*document\.write\s*\(\s*`([^`]*)`\s*\)\s*;?\s*<\/script>/gi;

  let match;

  // Обрабатываем простые переменные
  while ((match = simplePattern.exec(html)) !== null) {
    const variableName = match[1];
    const scriptTag = match[0];

    // Получаем значение из извлеченных данных
    const extractedValue = valueMap.get(variableName) || '';

    if (!variables.find((v) => v.name === variableName)) {
      variables.push({
        name: variableName,
        value: extractedValue,
        scriptTag,
        isProtected: true,
      });
    }
  }

  // Обрабатываем шаблонные строки
  while ((match = templatePattern.exec(html)) !== null) {
    const template = match[1];

    // Улучшенный паттерн для извлечения переменных из шаблона
    // Поддерживает: ${variable}, ${people[0].name}, ${user.profile.email}, ${data.items[0].title}
    const variableMatches = template.match(/\$\{([^}]+)\}/g);
    if (variableMatches) {
      variableMatches.forEach((varMatch) => {
        const variablePath = varMatch.replace(/\$\{|\}/g, '');
        // Создаем уникальное имя переменной на основе пути
        const variableName = variablePath.replace(/[\[\]\.]/g, '_');

        // Извлекаем значение для глубокого пути
        let extractedValue = '';
        try {
          // Пытаемся найти значение по пути
          const pathParts = variablePath
            .split(/[\.\[\]]/)
            .filter((part) => part !== '');
          if (pathParts.length > 0) {
            const rootVar = pathParts[0];
            const rootValue = valueMap.get(rootVar);

            if (rootValue) {
              try {
                // Пытаемся распарсить как JSON
                let parsedRoot;
                try {
                  parsedRoot = JSON.parse(rootValue);
                } catch {
                  // Если JSON не парсится, пробуем eval
                  parsedRoot = eval(`(${rootValue})`);
                }
                // Убираем первый элемент пути, так как мы уже получили корневой объект
                const remainingPath = pathParts.slice(1).join('.');
                extractedValue = getValueByPath(parsedRoot, remainingPath);
              } catch {
                // Если не удалось распарсить, используем как строку
                extractedValue = rootValue;
              }
            } else {
              // Если корневая переменная не найдена, оставляем пустым
              // Это поможет пользователю понять, что переменная не определена
              extractedValue = '';
            }
          }
        } catch {
          // Если не удалось извлечь значение, оставляем пустым
        }

        if (!variables.find((v) => v.name === variableName)) {
          variables.push({
            name: variableName,
            value: extractedValue,
            scriptTag: `<script>document.write(\`${template}\`);</script>`, // Сохраняем оригинальный шаблон
            isProtected: true,
          });
        }
      });
    }
  }

  return variables;
}

/**
 * Заменяет переменные в HTML на их значения
 */
export function replaceVariablesInHtml(
  html: string,
  variables: VariableItem[],
): string {
  let result = html;

  for (const variable of variables) {
    const scriptPattern = new RegExp(
      `<script>\\s*document\\.write\\s*\\(\\s*${variable.name}\\s*\\)\\s*;?\\s*</script>`,
      'gi',
    );
    result = result.replace(scriptPattern, variable.value);
  }

  return result;
}

/**
 * Создает защищенный HTML с переменными
 * Заменяет script теги на защищенные span элементы
 */
export function createProtectedHtml(
  html: string,
  variables: VariableItem[],
): string {
  let result = html;

  // Сначала извлекаем все переменные из HTML
  const extractedVars = extractVariablesFromHtml(html);

  // Объединяем с переданными переменными
  const allVariables = [...extractedVars, ...variables];

  // Создаем карту переменных для быстрого доступа
  const variableMap = new Map(allVariables.map((v) => [v.name, v.value]));

  // Обрабатываем простые переменные: document.write(variableName);
  for (const variable of allVariables) {
    const simplePattern = new RegExp(
      `<script>\\s*document\\.write\\s*\\(\\s*${variable.name}\\s*\\)\\s*;?\\s*</script>`,
      'gi',
    );
    result = result.replace(
      simplePattern,
      `<span data-variable="${
        variable.name
      }" data-protected="true" contenteditable="false" style="background-color: #f0f0f0; padding: 2px 4px; border-radius: 3px; border: 1px solid #ddd; color: #666; font-family: monospace; font-size: 0.9em;">${
        variable.value || `[${variable.name}]`
      }</span>`,
    );
  }

  // Обрабатываем шаблонные строки: document.write(`template with ${variable}`);
  const templatePattern =
    /<script>\s*document\.write\s*\(\s*`([^`]*)`\s*\)\s*;?\s*<\/script>/gi;
  result = result.replace(templatePattern, (match, template) => {
    // Заменяем переменные в шаблоне на их значения
    let processedTemplate = template;
    // Улучшенный паттерн для поиска всех переменных, включая глубокие пути
    const variableMatches = template.match(/\$\{([^}]+)\}/g);

    if (variableMatches) {
      variableMatches.forEach((varMatch: string) => {
        const variablePath = varMatch.replace(/\$\{|\}/g, '');
        // Создаем имя переменной на основе пути для поиска в карте
        const variableName = variablePath.replace(/[\[\]\.]/g, '_');
        const variableValue =
          variableMap.get(variableName) || `[${variablePath}]`;
        processedTemplate = processedTemplate.replace(varMatch, variableValue);
      });
    }

    return `<span data-template="true" data-original-template="${template}" data-protected="true" contenteditable="false" style="background-color: #e8f4fd; padding: 2px 4px; border-radius: 3px; border: 1px solid #bee5eb; color: #0c5460; font-family: monospace; font-size: 0.9em;">${processedTemplate}</span>`;
  });

  return result;
}

/**
 * Восстанавливает оригинальные script теги из защищенного HTML
 */
export function restoreScriptTags(html: string): string {
  // Восстанавливаем простые переменные
  const protectedPattern =
    /<span[^>]*data-variable="(\w+)"[^>]*data-protected="true"[^>]*>([^<]*)<\/span>/gi;
  let result = html.replace(protectedPattern, (match, variableName) => {
    return `<script>document.write(${variableName});</script>`;
  });

  // Восстанавливаем шаблонные строки
  const templatePattern =
    /<span[^>]*data-template="true"[^>]*data-original-template="([^"]*)"[^>]*data-protected="true"[^>]*>([^<]*)<\/span>/gi;
  result = result.replace(templatePattern, (match, originalTemplate) => {
    // Восстанавливаем оригинальный шаблон с переменными в формате ${variable}
    return `<script>document.write(\`${originalTemplate}\`);</script>`;
  });

  return result;
}

/**
 * Обновляет значение переменной в защищенном HTML
 */
export function updateVariableValue(
  html: string,
  variableName: string,
  newValue: string,
): string {
  // Обновляем простые переменные
  const protectedPattern = new RegExp(
    `(<span[^>]*data-variable="${variableName}"[^>]*data-protected="true"[^>]*>)[^<]*(</span>)`,
    'gi',
  );

  let result = html.replace(protectedPattern, `$1${newValue}$2`);

  // Обновляем переменные в шаблонных строках
  const templatePattern =
    /<span[^>]*data-template="true"[^>]*data-original-template="([^"]*)"[^>]*data-protected="true"[^>]*>([^<]*)<\/span>/gi;
  result = result.replace(
    templatePattern,
    (match, originalTemplate, content) => {
      // Заменяем переменную в содержимом шаблона
      // Поддерживаем как простые имена переменных, так и глубокие пути
      const updatedContent = content.replace(
        new RegExp(`\\[${variableName}\\]`, 'g'),
        newValue,
      );
      return match.replace(content, updatedContent);
    },
  );

  return result;
}

/**
 * Восстанавливает script теги с актуальными значениями переменных
 */
export function restoreScriptTagsWithValues(
  html: string,
  variables: VariableItem[],
): string {
  let result = html;

  // Создаем карту переменных для быстрого доступа
  const variableMap = new Map(variables.map((v) => [v.name, v.value]));

  // Восстанавливаем простые переменные с актуальными значениями
  const protectedPattern =
    /<span[^>]*data-variable="(\w+)"[^>]*data-protected="true"[^>]*>([^<]*)<\/span>/gi;
  result = result.replace(
    protectedPattern,
    (match, variableName, currentValue) => {
      const actualValue = variableMap.get(variableName) || currentValue;
      // Заменяем на актуальное значение вместо переменной
      return actualValue;
    },
  );

  // Восстанавливаем шаблонные строки с актуальными значениями
  const templatePattern =
    /<span[^>]*data-template="true"[^>]*data-original-template="([^"]*)"[^>]*data-protected="true"[^>]*>([^<]*)<\/span>/gi;
  result = result.replace(
    templatePattern,
    (match, originalTemplate, content) => {
      // Содержимое уже содержит актуальные значения переменных
      return content;
    },
  );

  return result;
}
