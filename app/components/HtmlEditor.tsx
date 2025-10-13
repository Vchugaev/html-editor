'use client';

import { Flex, Box, useColorModeValue } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import PreviewPane from './PreviewPane';
import EditorPanel from './EditorPanel';
import { AttributeItem } from '../types/editor';
import { processZipForPreview, generateZipBlob } from '../utils/zip';
import JSZip from 'jszip';
import { useIframeSelection } from '../hooks/useIframeSelection';
import { useElementCss } from '../hooks/useElementCss';
import {
  createProtectedHtml,
  restoreScriptTagsWithValues,
} from '../utils/variables';
import {
  extractAllTexts,
  saveTextsToJSON,
  TextNode,
} from '../utils/textExtractor';

export default function HtmlEditor() {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [zip, setZip] = useState<JSZip | null>(null);
  const [fileMap, setFileMap] = useState<Map<string, string>>(new Map());
  const [indexPath, setIndexPath] = useState<string | null>(null);
  const [siteRoot, setSiteRoot] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number>(320);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const minPanelWidth = 180; // можно сузить правую панель сильнее
  const minLeftWidth = 280; // целим в «телефонную» ширину превью
  const separatorWidth = 6; // соответствует w="6px"
  const gapPx = 24; // Chakra gap=6 => 24px
  const paddingPx = 24; // Chakra p=6 => 24px слева/справа

  const {
    selectedElement,
    textValue,
    attributes,
    variables,
    updateText,
    updateAttribute,
    setAttributes,
    updateVariable,
    initializeVariables,
  } = useIframeSelection(iframeRef, iframeUrl);

  const { cssProps, setCssProp } = useElementCss(iframeRef, selectedElement);

  const handleUpload = async (file: File) => {
    const processed = await processZipForPreview(file);
    setZip(processed.zip as JSZip);
    setFileMap(processed.fileMap);
    setIndexPath(processed.indexPath);
    setSiteRoot(processed.siteRoot);

    // Инициализируем переменные из HTML
    initializeVariables(processed.htmlForPreview);

    // Создаем защищенный HTML с переменными
    const protectedHtml = createProtectedHtml(processed.htmlForPreview, []);

    const blobUrl = URL.createObjectURL(
      new Blob([protectedHtml], { type: 'text/html' }),
    );
    setIframeUrl(blobUrl);

    // Ждем загрузки iframe, затем извлекаем тексты и запускаем анимацию
    setTimeout(() => {
      if (iframeRef.current?.contentDocument) {
        const doc = iframeRef.current.contentDocument;
        const body = doc.body;

        if (body) {
          // Извлекаем все тексты
          const texts = extractAllTexts(body);

          // Сохраняем тексты в JSON (для будущего использования)
          const jsonTexts = saveTextsToJSON(texts);
          console.log('Извлеченные тексты:', jsonTexts);
        }
      }
    }, 100); // Минимальная задержка для полной загрузки iframe
  };

  const handleImageChange = async (file: File) => {
    if (!zip || !selectedElement) return;
    const timestamp = Date.now();
    // Создаем путь относительно корневой папки сайта
    const zipFilePath = siteRoot
      ? `${siteRoot}/images/${timestamp}_${file.name}`
      : `images/${timestamp}_${file.name}`;

    const arrayBuffer = await file.arrayBuffer();
    zip.file(zipFilePath, arrayBuffer);

    const blobUrl = URL.createObjectURL(file);
    selectedElement.setAttribute('src', blobUrl);

    setFileMap((prev) => new Map(prev).set(zipFilePath, blobUrl));

    const idx = attributes.findIndex((a) => a.name === 'src');
    if (idx !== -1) {
      const next: AttributeItem[] = [...attributes];
      next[idx] = { name: 'src', value: zipFilePath, blobUrl };
      setAttributes(next);
    } else {
      setAttributes([
        ...attributes,
        { name: 'src', value: zipFilePath, blobUrl },
      ]);
    }
  };

  const handleDownload = async () => {
    if (!zip || !iframeRef.current || !indexPath) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    let htmlText = doc.documentElement.outerHTML;

    // Восстанавливаем script теги с актуальными значениями переменных
    htmlText = restoreScriptTagsWithValues(htmlText, variables);

    // Функция для преобразования путей архива в относительные пути сайта
    const convertArchivePathToSitePath = (archivePath: string): string => {
      if (!siteRoot) return archivePath;

      // Если путь начинается с корневой папки сайта, убираем её
      if (archivePath.startsWith(siteRoot + '/')) {
        return archivePath.substring(siteRoot.length + 1);
      }

      return archivePath;
    };

    // Заменяем blob URL на относительные пути сайта
    for (const [path, blobUrl] of fileMap.entries()) {
      const siteRelativePath = convertArchivePathToSitePath(path);
      htmlText = htmlText.split(blobUrl).join(siteRelativePath);
    }

    zip.file(indexPath, htmlText);
    const zipBlob = await generateZipBlob(zip);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'updated_site.zip';
    a.click();
  };

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const innerWidth = rect.width - paddingPx * 2;
      // от правого внутреннего края до курсора — предполагаемая ширина панели
      const rightInner = rect.right - paddingPx;
      const proposed = rightInner - e.clientX;
      // максимально допустимая ширина панели, чтобы слева осталось minLeftWidth
      const maxAllowed = Math.max(
        minPanelWidth,
        innerWidth - separatorWidth - gapPx * 2 - minLeftWidth,
      );
      const clamped = Math.min(Math.max(proposed, minPanelWidth), maxAllowed);
      setPanelWidth(clamped);
    };
    const handleUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const appBg = useColorModeValue('gray.100', 'gray.900');
  const sepBg = useColorModeValue('gray.200', 'whiteAlpha.300');
  const sepHoverBg = useColorModeValue('gray.300', 'whiteAlpha.400');
  return (
    <Flex
      p={6}
      gap={6}
      h="100vh"
      bg={appBg}
      fontFamily="Inter, sans-serif"
      ref={containerRef}
    >
      <PreviewPane
        onUpload={handleUpload}
        iframeUrl={iframeUrl}
        iframeRef={iframeRef}
      />
      {/* split handle */}
      <Box
        role="separator"
        aria-orientation="vertical"
        cursor={isResizing ? 'col-resize' : 'ew-resize'}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        onDoubleClick={() => setPanelWidth(320)}
        w="6px"
        bg={isResizing ? 'blue.300' : sepBg}
        borderRadius="md"
        _hover={{ bg: sepHoverBg }}
        alignSelf="stretch"
      />
      <EditorPanel
        selectedElement={selectedElement}
        textValue={textValue}
        attributes={attributes}
        variables={variables}
        onTextChange={updateText}
        onAttrChange={updateAttribute}
        onVariableChange={updateVariable}
        onImageChange={handleImageChange}
        onDownload={handleDownload}
        width={panelWidth}
        cssProps={cssProps}
        onCssChange={setCssProp}
        iframeRef={iframeRef}
      />
    </Flex>
  );
}
