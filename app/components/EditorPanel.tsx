'use client';

import {
  Box,
  Button,
  Divider,
  HStack,
  Heading,
  Image,
  Input,
  Text,
  VStack,
  Badge,
  SimpleGrid,
  Select,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  useColorMode,
  useColorModeValue,
  IconButton,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  Tooltip,
} from '@chakra-ui/react';
import { MoonIcon, SunIcon, RepeatIcon } from '@chakra-ui/icons';
import { Fragment, useState } from 'react';
import { useEffect, useRef } from 'react';
import { AttributeItem, VariableItem } from '../types/editor';
import { translateElement } from '../utils/translation';

interface EditorPanelProps {
  selectedElement: HTMLElement | null;
  textValue: string;
  attributes: AttributeItem[];
  variables: VariableItem[];
  onTextChange: (value: string) => void;
  onAttrChange: (index: number, value: string) => void;
  onVariableChange: (variableName: string, value: string) => void;
  onImageChange: (file: File) => void;
  onDownload: () => void;
  width?: number;
  cssProps?: { property: string; value: string }[];
  onCssChange?: (property: string, value: string) => void;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}

export default function EditorPanel({
  selectedElement,
  textValue,
  attributes,
  variables,
  onTextChange,
  onAttrChange,
  onVariableChange,
  onImageChange,
  onDownload,
  width,
  cssProps,
  onCssChange,
}: EditorPanelProps) {
  const { colorMode, toggleColorMode } = useColorMode();
  const panelBg = useColorModeValue('white', 'gray.800');
  const headingColor = useColorModeValue('gray.700', 'gray.100');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.300');
  const subPanelBg = useColorModeValue('gray.50', 'whiteAlpha.100');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Состояние для перевода
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<string>('');
  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const getCss = (name: string) =>
    cssProps?.find((p) => p.property === name)?.value || '';
  const setCss = (name: string, value: string) =>
    onCssChange && onCssChange(name, value);

  const parseLength = (val: string): { num: string; unit: string } => {
    const m = /^\s*(-?\d*\.?\d+)\s*(px|rem|em|%|vh|vw)?\s*$/i.exec(val || '');
    return { num: m?.[1] ?? '', unit: m?.[2] ?? 'px' };
  };

  // Загружаем доступные языки
  useEffect(() => {
    // Загрузка языков больше не нужна, так как setAvailableLanguages удален
  }, []);

  // Сохраняем оригинальный текст
  useEffect(() => {
    if (textValue && textValue !== originalText && !isTranslating) {
      setOriginalText(textValue);
    }
  }, [textValue, originalText, isTranslating]);

  // Функция перевода отдельного элемента
  const handleTranslateElement = async () => {
    if (!textValue.trim()) {
      setTranslationError('Нет текста для перевода');
      return;
    }

    setTranslationError(null);
    setIsTranslating(true);

    try {
      // Сохраняем оригинальный текст для возможности восстановления
      if (!originalText) {
        setOriginalText(textValue);
      }

      const result = await translateElement(
        textValue,
        selectedLanguage,
        selectedElement?.tagName.toLowerCase(),
      );

      if (result.success && result.translatedText) {
        onTextChange(result.translatedText);
      } else {
        setTranslationError(result.error || 'Ошибка при переводе');
      }
    } catch (error) {
      console.error('Ошибка при переводе:', error);
      setTranslationError('Ошибка соединения с сервером перевода');
    } finally {
      setIsTranslating(false);
    }
  };

  // Функция восстановления оригинального текста
  const handleRestoreOriginal = () => {
    if (originalText) {
      onTextChange(originalText);
    }
  };

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== textValue) {
      el.innerHTML = textValue || '';
    }
  }, [textValue, selectedElement]);
  return (
    <Box
      w={width ? `${width}px` : '320px'}
      p={6}
      bg={panelBg}
      borderRadius="lg"
      shadow="xl"
      overflowY="auto"
    >
      <VStack align="stretch" spacing={5}>
        <HStack justify="space-between" align="center">
          <Heading size="md" color={headingColor}>
            Редактор элемента
          </Heading>
          <IconButton
            aria-label="Toggle color mode"
            size="sm"
            onClick={toggleColorMode}
            variant="ghost"
            icon={colorMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          />
        </HStack>
        <Divider />

        {selectedElement ? (
          <>
            {selectedElement.tagName.toLowerCase() !== 'img' && (
              <Box>
                <Text fontSize="sm" color="gray.500" mb={2}>
                  Текст элемента:
                </Text>
                <HStack spacing={2} mb={2} wrap="wrap">
                  <HStack spacing={1}>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => exec('bold')}
                    >
                      B
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => exec('italic')}
                    >
                      I
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => exec('underline')}
                    >
                      U
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => exec('strikeThrough')}
                    >
                      S
                    </Button>
                  </HStack>
                  <Divider orientation="vertical" h="20px" />
                  <HStack spacing={1}>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => exec('formatBlock', 'H1')}
                    >
                      H1
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => exec('formatBlock', 'H2')}
                    >
                      H2
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => exec('formatBlock', 'P')}
                    >
                      P
                    </Button>
                  </HStack>
                  <Divider orientation="vertical" h="20px" />
                  <HStack spacing={1}>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        const url = window.prompt('Вставьте URL:', 'https://');
                        if (!url) return;
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                          exec('createLink', url);
                        } else {
                          editorRef.current?.focus();
                          document.execCommand(
                            'insertHTML',
                            false,
                            `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
                          );
                        }
                      }}
                    >
                      Ссылка
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => exec('unlink')}
                    >
                      Убрать ссылку
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        exec('removeFormat');
                        exec('formatBlock', 'P');
                      }}
                    >
                      Очистить
                    </Button>
                  </HStack>
                </HStack>
                <Box
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) =>
                    onTextChange((e.target as HTMLElement).innerHTML)
                  }
                  borderWidth="1px"
                  borderColor={borderColor}
                  _focusWithin={{
                    borderColor: 'blue.400',
                    boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)',
                  }}
                  borderRadius="md"
                  p={3}
                  minH="140px"
                  mb={4}
                  fontSize="sm"
                  sx={{
                    '& a': { color: 'blue.500', textDecoration: 'underline' },
                  }}
                />
              </Box>
            )}

            <Text fontSize="sm" color="gray.500">
              Атрибуты:
            </Text>

            {attributes.map((attr, index) => (
              <HStack key={attr.name} spacing={2} mb={2}>
                <Text w="30%" fontSize="xs" color="gray.500">
                  {attr.name}
                </Text>

                {attr.name === 'src' &&
                selectedElement.tagName.toLowerCase() === 'img' ? (
                  <Box flex={1}>
                    <Box
                      position="relative"
                      cursor="pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Image
                        src={attr.blobUrl || attr.value}
                        alt="Предпросмотр изображения"
                        maxH="160px"
                        w="100%"
                        objectFit="contain"
                        mb={2}
                        borderRadius="md"
                        shadow="sm"
                      />
                      <Box
                        position="absolute"
                        bottom="3"
                        left="50%"
                        transform="translateX(-50%)"
                        bg="blackAlpha.700"
                        color="white"
                        px={3}
                        py={1}
                        borderRadius="full"
                        fontSize="xs"
                        shadow="md"
                        pointerEvents="none"
                      >
                        Нажмите, чтобы заменить
                      </Box>
                    </Box>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      size="sm"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onImageChange(f);
                        if (e.target) (e.target as HTMLInputElement).value = '';
                      }}
                      display="none"
                    />
                  </Box>
                ) : (
                  <Input
                    size="sm"
                    value={attr.value}
                    onChange={(e) => onAttrChange(index, e.target.value)}
                    borderRadius="md"
                    focusBorderColor="blue.400"
                  />
                )}
              </HStack>
            ))}

            {/* Панель управления переменными */}
            {variables.length > 0 && (
              <>
                <Divider my={3} />
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.600">
                    Переменные
                  </Text>
                  <Badge colorScheme="green" variant="subtle">
                    {variables.length}
                  </Badge>
                </HStack>
                <Box
                  borderWidth="1px"
                  borderColor={borderColor}
                  bg={subPanelBg}
                  borderRadius="md"
                  p={3}
                >
                  <VStack spacing={3} align="stretch">
                    {variables.map((variable) => (
                      <Box key={variable.name}>
                        <HStack justify="space-between" mb={1}>
                          <Text
                            fontSize="xs"
                            color="gray.600"
                            fontFamily="mono"
                          >
                            {variable.name}
                          </Text>
                          <Badge size="sm" colorScheme="blue" variant="outline">
                            Защищено
                          </Badge>
                        </HStack>
                        <Input
                          size="sm"
                          value={variable.value}
                          onChange={(e) =>
                            onVariableChange(variable.name, e.target.value)
                          }
                          placeholder={`Введите значение для ${variable.name}`}
                          focusBorderColor="green.400"
                          bg="white"
                          _dark={{ bg: 'gray.700' }}
                        />
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          Изменения применяются в реальном времени
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              </>
            )}

            {/* CSS свойства выбранного элемента (по совпадающим правилам) */}
            {cssProps && cssProps.length > 0 && (
              <>
                <Divider my={3} />
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.600">
                    CSS свойства
                  </Text>
                  <Badge colorScheme="purple" variant="subtle">
                    CSS
                  </Badge>
                </HStack>
                {/* Быстрые контролы популярных свойств */}
                <Box mb={2}>
                  <SimpleGrid
                    columns={2}
                    spacingY={2}
                    columnGap={3}
                    alignItems="center"
                  >
                    {/* color */}
                    <Text fontSize="xs" color="gray.700" fontFamily="mono">
                      color
                    </Text>
                    <HStack>
                      <Input
                        type="color"
                        size="xs"
                        p={0}
                        w="40px"
                        value={
                          /^#/.test(getCss('color'))
                            ? getCss('color')
                            : '#000000'
                        }
                        onChange={(e) => setCss('color', e.target.value)}
                      />
                      <Input
                        size="xs"
                        value={getCss('color')}
                        onChange={(e) => setCss('color', e.target.value)}
                      />
                    </HStack>

                    {/* background-color */}
                    <Text fontSize="xs" color="gray.700" fontFamily="mono">
                      background-color
                    </Text>
                    <HStack>
                      <Input
                        type="color"
                        size="xs"
                        p={0}
                        w="40px"
                        value={
                          /^#/.test(getCss('background-color'))
                            ? getCss('background-color')
                            : '#ffffff'
                        }
                        onChange={(e) =>
                          setCss('background-color', e.target.value)
                        }
                      />
                      <Input
                        size="xs"
                        value={getCss('background-color')}
                        onChange={(e) =>
                          setCss('background-color', e.target.value)
                        }
                      />
                    </HStack>

                    {/* border-color */}
                    <Text fontSize="xs" color="gray.700" fontFamily="mono">
                      border-color
                    </Text>
                    <HStack>
                      <Input
                        type="color"
                        size="xs"
                        p={0}
                        w="40px"
                        value={
                          /^#/.test(getCss('border-color'))
                            ? getCss('border-color')
                            : '#000000'
                        }
                        onChange={(e) => setCss('border-color', e.target.value)}
                      />
                      <Input
                        size="xs"
                        value={getCss('border-color')}
                        onChange={(e) => setCss('border-color', e.target.value)}
                      />
                    </HStack>

                    {/* opacity */}
                    <Text fontSize="xs" color="gray.700" fontFamily="mono">
                      opacity
                    </Text>
                    <HStack w="full">
                      <Slider
                        size="sm"
                        min={0}
                        max={1}
                        step={0.05}
                        value={Number(getCss('opacity')) || 1}
                        onChange={(v) => setCss('opacity', String(v))}
                      >
                        <SliderTrack>
                          <SliderFilledTrack />
                        </SliderTrack>
                        <SliderThumb boxSize={3} />
                      </Slider>
                      <Input
                        w="64px"
                        size="xs"
                        value={getCss('opacity') || '1'}
                        onChange={(e) => setCss('opacity', e.target.value)}
                      />
                    </HStack>

                    {/* font-size */}
                    <Text fontSize="xs" color="gray.700" fontFamily="mono">
                      font-size
                    </Text>
                    <HStack>
                      {(() => {
                        const { num, unit } = parseLength(getCss('font-size'));
                        return (
                          <>
                            <Input
                              w="70px"
                              size="xs"
                              value={num}
                              onChange={(e) =>
                                setCss('font-size', `${e.target.value}${unit}`)
                              }
                            />
                            <Select
                              w="70px"
                              size="xs"
                              value={unit}
                              onChange={(e) =>
                                setCss('font-size', `${num}${e.target.value}`)
                              }
                            >
                              <option value="px">px</option>
                              <option value="rem">rem</option>
                              <option value="em">em</option>
                              <option value="%">%</option>
                            </Select>
                          </>
                        );
                      })()}
                    </HStack>

                    {/* border-radius */}
                    <Text fontSize="xs" color="gray.700" fontFamily="mono">
                      border-radius
                    </Text>
                    <HStack>
                      {(() => {
                        const { num, unit } = parseLength(
                          getCss('border-radius'),
                        );
                        return (
                          <>
                            <Input
                              w="70px"
                              size="xs"
                              value={num}
                              onChange={(e) =>
                                setCss(
                                  'border-radius',
                                  `${e.target.value}${unit}`,
                                )
                              }
                            />
                            <Select
                              w="70px"
                              size="xs"
                              value={unit}
                              onChange={(e) =>
                                setCss(
                                  'border-radius',
                                  `${num}${e.target.value}`,
                                )
                              }
                            >
                              <option value="px">px</option>
                              <option value="rem">rem</option>
                              <option value="em">em</option>
                              <option value="%">%</option>
                            </Select>
                          </>
                        );
                      })()}
                    </HStack>

                    {/* width */}
                    <Text fontSize="xs" color="gray.700" fontFamily="mono">
                      width
                    </Text>
                    <VStack w="full" spacing={2}>
                      {(() => {
                        const { num, unit } = parseLength(getCss('width'));
                        const numericValue = Number(num) || 0;
                        const maxValue =
                          unit === '%'
                            ? 100
                            : unit === 'vw'
                            ? 100
                            : unit === 'vh'
                            ? 100
                            : 1000;
                        return (
                          <>
                            <Slider
                              size="sm"
                              min={0}
                              max={maxValue}
                              step={unit === '%' ? 1 : 10}
                              value={numericValue}
                              onChange={(v) => setCss('width', `${v}${unit}`)}
                              w="full"
                            >
                              <SliderTrack>
                                <SliderFilledTrack />
                              </SliderTrack>
                              <SliderThumb boxSize={3} />
                            </Slider>
                            <HStack w="full" spacing={2}>
                              <Input
                                w="70px"
                                size="xs"
                                value={num}
                                onChange={(e) =>
                                  setCss('width', `${e.target.value}${unit}`)
                                }
                              />
                              <Select
                                w="70px"
                                size="xs"
                                value={unit}
                                onChange={(e) =>
                                  setCss('width', `${num}${e.target.value}`)
                                }
                              >
                                <option value="px">px</option>
                                <option value="rem">rem</option>
                                <option value="em">em</option>
                                <option value="%">%</option>
                                <option value="vw">vw</option>
                                <option value="vh">vh</option>
                              </Select>
                            </HStack>
                          </>
                        );
                      })()}
                    </VStack>

                    {/* height */}
                    <Text fontSize="xs" color="gray.700" fontFamily="mono">
                      height
                    </Text>
                    <VStack w="full" spacing={2}>
                      {(() => {
                        const { num, unit } = parseLength(getCss('height'));
                        const numericValue = Number(num) || 0;
                        const maxValue =
                          unit === '%'
                            ? 100
                            : unit === 'vw'
                            ? 100
                            : unit === 'vh'
                            ? 100
                            : 1000;
                        return (
                          <>
                            <Slider
                              size="sm"
                              min={0}
                              max={maxValue}
                              step={unit === '%' ? 1 : 10}
                              value={numericValue}
                              onChange={(v) => setCss('height', `${v}${unit}`)}
                              w="full"
                            >
                              <SliderTrack>
                                <SliderFilledTrack />
                              </SliderTrack>
                              <SliderThumb boxSize={3} />
                            </Slider>
                            <HStack w="full" spacing={2}>
                              <Input
                                w="70px"
                                size="xs"
                                value={num}
                                onChange={(e) =>
                                  setCss('height', `${e.target.value}${unit}`)
                                }
                              />
                              <Select
                                w="70px"
                                size="xs"
                                value={unit}
                                onChange={(e) =>
                                  setCss('height', `${num}${e.target.value}`)
                                }
                              >
                                <option value="px">px</option>
                                <option value="rem">rem</option>
                                <option value="em">em</option>
                                <option value="%">%</option>
                                <option value="vw">vw</option>
                                <option value="vh">vh</option>
                              </Select>
                            </HStack>
                          </>
                        );
                      })()}
                    </VStack>

                    {/* text-align */}
                    <Text fontSize="xs" color="gray.700" fontFamily="mono">
                      text-align
                    </Text>
                    <Select
                      size="xs"
                      value={getCss('text-align') || ''}
                      onChange={(e) => setCss('text-align', e.target.value)}
                    >
                      <option value=""></option>
                      <option value="left">left</option>
                      <option value="center">center</option>
                      <option value="right">right</option>
                      <option value="justify">justify</option>
                    </Select>

                    {/* font-weight */}
                    <Text fontSize="xs" color="gray.700" fontFamily="mono">
                      font-weight
                    </Text>
                    <Select
                      size="xs"
                      value={getCss('font-weight') || ''}
                      onChange={(e) => setCss('font-weight', e.target.value)}
                    >
                      <option value=""></option>
                      <option value="300">300</option>
                      <option value="400">400</option>
                      <option value="500">500</option>
                      <option value="600">600</option>
                      <option value="700">700</option>
                      <option value="bold">bold</option>
                    </Select>
                  </SimpleGrid>
                </Box>
                <Box
                  borderWidth="1px"
                  borderColor={borderColor}
                  bg={subPanelBg}
                  borderRadius="md"
                  p={2}
                >
                  <SimpleGrid
                    columns={2}
                    spacingY={1}
                    columnGap={3}
                    alignItems="center"
                  >
                    {cssProps.map((p) => (
                      <Fragment key={p.property}>
                        <Text
                          fontSize="xs"
                          color="gray.600"
                          fontFamily="mono"
                          noOfLines={1}
                        >
                          {p.property}
                        </Text>
                        <Input
                          size="xs"
                          variant="flushed"
                          value={p.value}
                          onChange={(e) =>
                            onCssChange &&
                            onCssChange(p.property, e.target.value)
                          }
                          focusBorderColor="purple.400"
                          px={1}
                        />
                      </Fragment>
                    ))}
                  </SimpleGrid>
                </Box>
              </>
            )}

            <Button
              colorScheme="blue"
              mt={3}
              w="full"
              borderRadius="md"
              shadow="sm"
              _hover={{ bg: 'blue.500' }}
              onClick={onDownload}
            >
              Скачать ZIP
            </Button>

            {/* Секция перевода */}
            <Divider my={3} />
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" color="gray.600">
                Умный перевод
              </Text>
              <Badge colorScheme="blue" variant="subtle">
                🌐
              </Badge>
            </HStack>
            <Box
              borderWidth="1px"
              borderColor={borderColor}
              bg={subPanelBg}
              borderRadius="md"
              p={3}
            >
              <VStack spacing={3} align="stretch">
                {translationError && (
                  <Alert status="error" borderRadius="md" size="sm">
                    <AlertIcon />
                    <AlertDescription fontSize="xs">
                      {translationError}
                    </AlertDescription>
                  </Alert>
                )}

                <Box>
                  <Text fontSize="xs" color="gray.600" mb={1}>
                    Язык перевода:
                  </Text>
                  <Input
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    size="sm"
                    placeholder="Например: русский, английский, español, français..."
                    borderRadius="md"
                    focusBorderColor="blue.400"
                    bg="white"
                    _dark={{ bg: 'gray.700' }}
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Введите язык на любом языке: русский, английский, español,
                    français, deutsch...
                  </Text>
                </Box>

                <HStack spacing={2}>
                  <Button
                    colorScheme="green"
                    size="sm"
                    onClick={handleTranslateElement}
                    isLoading={isTranslating}
                    loadingText="Переводим..."
                    leftIcon={isTranslating ? <Spinner size="xs" /> : undefined}
                    flex={1}
                    borderRadius="md"
                    isDisabled={
                      !textValue.trim() ||
                      isTranslating ||
                      selectedElement?.tagName.toLowerCase() === 'img'
                    }
                  >
                    Элемент
                  </Button>

                  {originalText && originalText !== textValue && (
                    <Tooltip label="Вернуть оригинал">
                      <IconButton
                        aria-label="Вернуть оригинальный текст"
                        icon={<RepeatIcon />}
                        size="sm"
                        variant="outline"
                        onClick={handleRestoreOriginal}
                        colorScheme="gray"
                      />
                    </Tooltip>
                  )}
                </HStack>

                <Text fontSize="xs" color="gray.500">
                  💡 Перевод отдельных элементов с сохранением HTML-разметки
                </Text>
              </VStack>
            </Box>
          </>
        ) : (
          <Text fontSize="sm" color="gray.400" mt={2}>
            Выберите элемент в iframe
          </Text>
        )}
      </VStack>
    </Box>
  );
}
