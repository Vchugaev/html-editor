# Система работы с переменными в HTML редакторе

## Описание функциональности

Реализована система для работы с переменными, которые вставляются в HTML через `<script>document.write(variable);</script>` и шаблонные строки `<script>document.write(\`template with ${variable}\`);</script>`.

## Основные возможности

### 1. Автоматическое обнаружение переменных

- Система автоматически находит все переменные в HTML коде
- Поддерживает простые переменные: `<script>document.write(product);</script>`
- Поддерживает шаблонные строки: `<script>document.write(\`${product} ®\`);</script>`

### 2. Защита от редактирования

- Переменные заменяются на защищенные span элементы
- Сгенерированный текст нельзя редактировать напрямую
- Визуальное выделение защищенных элементов

### 3. Управление переменными

- Панель управления переменными в редакторе
- Изменение значений в реальном времени
- Обновление всех вхождений переменной на странице

### 4. Корректное скачивание

- При скачивании восстанавливаются оригинальные script теги
- Сохраняется структура HTML с переменными

## Технические детали

### Файлы, которые были изменены:

- `app/types/editor.ts` - добавлен интерфейс VariableItem
- `app/utils/variables.ts` - утилиты для работы с переменными
- `app/hooks/useIframeSelection.ts` - хук для управления переменными
- `app/components/HtmlEditor.tsx` - интеграция с основным редактором
- `app/components/EditorPanel.tsx` - панель управления переменными

### Поддерживаемые форматы:

1. **Простые переменные**: `<script>document.write(variableName);</script>`
2. **Шаблонные строки**: `<script>document.write(\`template with ${variable}\`);</script>`

### Визуальное оформление:

- Простые переменные: серый фон с рамкой
- Шаблонные строки: голубой фон с рамкой
- Защищенные элементы не редактируются

## Использование

1. Загрузите HTML файл с переменными
2. Система автоматически обнаружит все переменные
3. В панели редактора появится секция "Переменные"
4. Изменяйте значения переменных в реальном времени
5. При скачивании переменные восстанавливаются в оригинальном виде

## Пример HTML с переменными

```html
<p>
  The treatment with the prolipolic formula has been specially designed to act
  only on fat cells. It does not affect any other cells in the human body.
  <script>
    document.write(product);
  </script>
  is fully approved by the FDA.
</p>

<p>
  Template string example:
  <script>
    document.write(\`${product} ®\`);
  </script>
  - this is a registered trademark.
</p>

<p>
  Complex template:
  <script>
    document.write(\`Price: $${price} (${discount}% off)\`);
  </script>
</p>
```

Все переменные будут автоматически обнаружены и доступны для редактирования в панели управления.
