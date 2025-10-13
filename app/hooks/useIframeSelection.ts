'use client';

import { useEffect, useState } from 'react';
import { AttributeItem, VariableItem } from '../types/editor';
import {
  extractVariablesFromHtml,
  createProtectedHtml,
  updateVariableValue,
} from '../utils/variables';

export function useIframeSelection(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  activationKey: string | null,
) {
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(
    null,
  );
  const [textValue, setTextValue] = useState('');
  const [attributes, setAttributes] = useState<AttributeItem[]>([]);
  const [variables, setVariables] = useState<VariableItem[]>([]);

  const normalizeHtmlForEditor = (html: string) =>
    html
      .replace(/\n|\r|\t/g, ' ')
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .trim();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Отмечаем JS-управляемые элементы
      markJSControlledElements(doc);

      const handleHover = (e: MouseEvent) => {
        const el = e.target as HTMLElement;
        if (el !== selectedElement) {
          // Не показываем hover для JS-управляемых элементов
          if (el.getAttribute('data-js-controlled') !== 'true') {
            el.style.outline = '2px dashed #A0AEC0';
            el.style.outlineOffset = '2px';
          }
        }
      };

      const handleLeave = (e: MouseEvent) => {
        const el = e.target as HTMLElement;
        if (el !== selectedElement) {
          // Не убираем outline для JS-управляемых элементов
          if (el.getAttribute('data-js-controlled') !== 'true') {
            el.style.outline = '';
          }
        }
      };

      const handleClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const el = e.target as HTMLElement;

        // Проверяем, является ли элемент JS-управляемым
        if (el.getAttribute('data-js-controlled') === 'true') {
          // Просто не позволяем редактировать JS-элементы
          return;
        }

        if (selectedElement && selectedElement !== el) {
          selectedElement.style.outline = '';
        }

        // Ensure element has a persistent editor id
        if (!el.getAttribute('data-editor-id')) {
          const uid = `e${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;
          el.setAttribute('data-editor-id', uid);
        }

        el.style.outline = '2px solid #3182CE';
        el.style.outlineOffset = '2px';

        setSelectedElement(el);
        setTextValue(normalizeHtmlForEditor(el.innerHTML));
        const rawAttrs = Array.from(el.attributes);
        const filteredAttrs: AttributeItem[] = [];
        for (const attr of rawAttrs) {
          if (attr.name.toLowerCase() === 'style') {
            const cleaned = attr.value
              .split(';')
              .map((s) => s.trim())
              .filter(Boolean)
              .filter((decl) => {
                const prop = decl.split(':')[0]?.trim().toLowerCase();
                return prop !== 'outline' && prop !== 'outline-offset';
              })
              .join('; ');
            if (cleaned) {
              filteredAttrs.push({ name: attr.name, value: cleaned });
            }
          } else {
            filteredAttrs.push({ name: attr.name, value: attr.value });
          }
        }
        setAttributes(filteredAttrs);
      };

      doc.addEventListener('click', handleClick);
      doc.addEventListener('mouseover', handleHover);
      doc.addEventListener('mouseout', handleLeave);
    };

    iframe.addEventListener('load', handleLoad);
    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [iframeRef, activationKey, selectedElement]);

  const updateText = (value: string) => {
    setTextValue(value);
    if (selectedElement) selectedElement.innerHTML = value;
  };

  const updateAttribute = (index: number, value: string) => {
    if (!selectedElement) return;
    const attr = attributes[index];
    selectedElement.setAttribute(attr.name, value);
    const newAttrs = [...attributes];
    newAttrs[index] = { ...newAttrs[index], value };
    setAttributes(newAttrs);
  };

  const updateVariable = (variableName: string, newValue: string) => {
    if (!iframeRef.current) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    // Обновляем значение переменной в состоянии
    setVariables((prev) => {
      const updated = prev.map((v) =>
        v.name === variableName ? { ...v, value: newValue } : v,
      );

      // Обновляем DOM после обновления состояния
      setTimeout(() => {
        updateDOMVariables(doc, variableName, newValue, updated);
      }, 0);

      return updated;
    });
  };

  const updateDOMVariables = (
    doc: Document,
    variableName: string,
    newValue: string,
    variables: VariableItem[],
  ) => {
    // Обновляем простые переменные
    const protectedSpans = doc.querySelectorAll(
      `span[data-variable="${variableName}"][data-protected="true"]`,
    );
    protectedSpans.forEach((span) => {
      // Принудительно обновляем содержимое
      const newSpan = span.cloneNode(true) as HTMLElement;
      newSpan.textContent = newValue;
      span.parentNode?.replaceChild(newSpan, span);
    });

    // Обновляем переменные в шаблонных строках
    const templateSpans = doc.querySelectorAll(
      `span[data-template="true"][data-protected="true"]`,
    );
    templateSpans.forEach((span) => {
      const originalTemplate = span.getAttribute('data-original-template');
      if (originalTemplate) {
        // Восстанавливаем оригинальный шаблон и заменяем переменные на актуальные значения
        let processedTemplate = originalTemplate;
        const variableMatches = originalTemplate.match(/\$\{([^}]+)\}/g);

        if (variableMatches) {
          variableMatches.forEach((varMatch) => {
            const varPath = varMatch.replace(/\$\{|\}/g, '');
            // Создаем имя переменной на основе пути для поиска в массиве переменных
            const varName = varPath.replace(/[\[\]\.]/g, '_');
            const varValue =
              variables.find((v) => v.name === varName)?.value ||
              `[${varPath}]`;
            processedTemplate = processedTemplate.replace(varMatch, varValue);
          });
        }

        // Принудительно обновляем содержимое
        const newSpan = span.cloneNode(true) as HTMLElement;
        newSpan.textContent = processedTemplate;
        span.parentNode?.replaceChild(newSpan, span);
      } else {
        // Fallback для старых элементов без data-original-template
        const content = span.textContent || '';
        const updatedContent = content.replace(
          new RegExp(`\\[${variableName}\\]`, 'g'),
          newValue,
        );

        // Принудительно обновляем содержимое
        const newSpan = span.cloneNode(true) as HTMLElement;
        newSpan.textContent = updatedContent;
        span.parentNode?.replaceChild(newSpan, span);
      }
    });
  };

  const initializeVariables = (html: string) => {
    const extractedVars = extractVariablesFromHtml(html);
    // Используем извлеченные значения переменных (они уже содержат значения из JavaScript-кода)
    setVariables(extractedVars);
  };

  const markJSControlledElements = (doc: Document) => {
    // Находим элементы, которые обновляются через getElementById
    const scripts = doc.querySelectorAll('script');
    const jsControlledIds = new Set<string>();

    scripts.forEach((script) => {
      const scriptContent = script.textContent || '';

      // Ищем паттерны типа document.getElementById('id').innerHTML
      const getElementByIdMatches = scriptContent.match(
        /document\.getElementById\(['"`]([^'"`]+)['"`]\)/g,
      );
      if (getElementByIdMatches) {
        getElementByIdMatches.forEach((match) => {
          const idMatch = match.match(
            /document\.getElementById\(['"`]([^'"`]+)['"`]\)/,
          );
          if (idMatch && idMatch[1]) {
            jsControlledIds.add(idMatch[1]);
          }
        });
      }

      // Ищем паттерны типа document.getElementById('id').textContent
      const textContentMatches = scriptContent.match(
        /document\.getElementById\(['"`]([^'"`]+)['"`]\)\.textContent/g,
      );
      if (textContentMatches) {
        textContentMatches.forEach((match) => {
          const idMatch = match.match(
            /document\.getElementById\(['"`]([^'"`]+)['"`]\)/,
          );
          if (idMatch && idMatch[1]) {
            jsControlledIds.add(idMatch[1]);
          }
        });
      }
    });

    // Добавляем визуальную индикацию для JS-управляемых элементов
    jsControlledIds.forEach((id) => {
      const element = doc.getElementById(id);
      if (element) {
        element.setAttribute('data-js-controlled', 'true');
        element.style.position = 'relative';
        element.style.cursor = 'not-allowed';

        // Добавляем подсказку
        element.setAttribute(
          'title',
          'Этот элемент управляется JavaScript и не может быть отредактирован',
        );

        // Создаем красивую плашку для JS-элемента
        const jsPlaque = doc.createElement('div');
        jsPlaque.style.cssText = `
          position: absolute;
          top: -12px;
          right: -8px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-size: 9px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 12px;
          z-index: 1000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 3px 10px rgba(102, 126, 234, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.2);
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          animation: jsPlaqueFloat 4s ease-in-out infinite;
          backdrop-filter: blur(10px);
          min-width: 60px;
        `;
        jsPlaque.innerHTML = '⚡ JS';
        element.appendChild(jsPlaque);

        // Добавляем стиль для самого элемента
        element.style.cssText += `
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.03), rgba(118, 75, 162, 0.03)) !important;
          border: 1px solid rgba(102, 126, 234, 0.2) !important;
          border-radius: 8px !important;
          padding: 12px !important;
          margin: 4px !important;
          position: relative !important;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1) !important;
          transition: all 0.3s ease !important;
        `;

        // Добавляем hover эффект
        element.addEventListener('mouseenter', () => {
          element.style.transform = 'translateY(-2px)';
          element.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)';
        });

        element.addEventListener('mouseleave', () => {
          element.style.transform = 'translateY(0)';
          element.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.1)';
        });

        // Добавляем CSS анимацию для плашки
        const plaqueStyle = doc.createElement('style');
        plaqueStyle.textContent = `
          @keyframes jsPlaqueFloat {
            0%, 100% { 
              transform: translateY(0px) scale(1);
              box-shadow: 0 3px 10px rgba(102, 126, 234, 0.4);
            }
            50% { 
              transform: translateY(-2px) scale(1.05);
              box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
          }
        `;
        doc.head.appendChild(plaqueStyle);
      }
    });
  };

  return {
    selectedElement,
    textValue,
    attributes,
    variables,
    updateText,
    updateAttribute,
    setAttributes,
    updateVariable,
    initializeVariables,
    markJSControlledElements,
  } as const;
}
