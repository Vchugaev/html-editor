// 🔥 Исправленный FileUploader
"use client";

import { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import {
  Box,
  Flex,
  Heading,
  Input,
  Button,
  Text,
  VStack,
  Divider,
  HStack,
  Image,
  Textarea,
} from "@chakra-ui/react";

interface Attr {
  name: string;
  value: string;
  blobUrl?: string;
}

export default function FileUploader() {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [zipData, setZipData] = useState<JSZip | null>(null);
  const [selectedEl, setSelectedEl] = useState<HTMLElement | null>(null);
  const [textValue, setTextValue] = useState("");
  const [attributes, setAttributes] = useState<Attr[]>([]);
  const [fileMap, setFileMap] = useState<Map<string, string>>(new Map());
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Загрузка ZIP
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const zip = new JSZip();
    const data = await zip.loadAsync(file);
    setZipData(zip);

    const map = new Map<string, string>();
    for (const [path, zipEntry] of Object.entries(data.files)) {
      if (!zipEntry.dir) {
        const content = await zipEntry.async("blob");
        map.set(path, URL.createObjectURL(content));
      }
    }
    setFileMap(map);

    const indexFile = Object.keys(data.files).find((p) =>
      p.endsWith("index.html")
    );
    if (!indexFile) return;

    let htmlText = await data.files[indexFile].async("string");

    // Заменяем пути на blob URL для превью
    for (const [path, blobUrl] of map.entries()) {
      htmlText = htmlText.replaceAll(path, blobUrl);
    }

    setIframeUrl(
      URL.createObjectURL(new Blob([htmlText], { type: "text/html" }))
    );
  }

  // Выбор элемента
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) return;

      const handleClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const el = e.target as HTMLElement;

        // Убираем подсветку со старого элемента
        if (selectedEl && selectedEl !== el) {
          selectedEl.style.outline = "";
        }

        // Подсвечиваем выбранный элемент
        el.style.outline = "2px solid #3182CE";
        el.style.outlineOffset = "2px";

        setSelectedEl(el);
        setTextValue(el.innerText);

        const attrs: Attr[] = Array.from(el.attributes).map((attr) => ({
          name: attr.name,
          value: attr.value,
        }));
        setAttributes(attrs);
        iframeDoc.addEventListener("click", handleClick);
        iframeDoc.addEventListener("mouseover", handleHover);
        iframeDoc.addEventListener("mouseout", handleLeave);
      };

      // 🔹 Подсветка при наведении (hover)
      const handleHover = (e: MouseEvent) => {
        const el = e.target as HTMLElement;
        if (el !== selectedEl) {
          el.style.outline = "2px dashed #A0AEC0";
          el.style.outlineOffset = "2px";
        }
      };

      // 🔹 Снятие подсветки при уходе курсора
      const handleLeave = (e: MouseEvent) => {
        const el = e.target as HTMLElement;
        if (el !== selectedEl) {
          el.style.outline = "";
        }
      };

      iframeDoc.addEventListener("click", handleClick);
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [iframeUrl]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTextValue(val);
    if (selectedEl) selectedEl.innerText = val;
  };

  const handleAttrChange = (index: number, value: string) => {
    if (!selectedEl) return;
    const attr = attributes[index];
    selectedEl.setAttribute(attr.name, value);
    const newAttrs = [...attributes];
    newAttrs[index].value = value;
    setAttributes(newAttrs);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedEl || !zipData) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const timestamp = Date.now();
    const zipFilePath = `images/${timestamp}_${file.name}`;

    // Сохраняем файл в ZIP с уникальным именем
    const arrayBuffer = await file.arrayBuffer();
    zipData.file(zipFilePath, arrayBuffer);

    // Для превью используем blob
    const blobUrl = URL.createObjectURL(file);

    // Обновляем выбранный элемент для превью
    selectedEl.setAttribute("src", blobUrl);

    // Обновляем fileMap
    setFileMap((prev) => new Map(prev).set(zipFilePath, blobUrl));

    // Обновляем атрибуты
    const index = attributes.findIndex((attr) => attr.name === "src");
    if (index !== -1) {
      const newAttrs = [...attributes];
      newAttrs[index] = { name: "src", value: zipFilePath, blobUrl };
      setAttributes(newAttrs);
    } else {
      setAttributes([
        ...attributes,
        { name: "src", value: zipFilePath, blobUrl },
      ]);
    }

    // 🔹 Обнуляем input, чтобы можно было выбрать тот же файл повторно
    e.target.value = "";
  };

  // 🔥 Полностью убираем blob при скачивании, проверяем весь HTML как текст
  const handleDownload = async () => {
    if (!zipData || !iframeRef.current) return;

    const iframeDoc = iframeRef.current.contentDocument;
    if (!iframeDoc) return;

    const indexFile = Object.keys(zipData.files).find((p) =>
      p.endsWith("index.html")
    );
    if (!indexFile) return;

    let htmlText = iframeDoc.documentElement.outerHTML;

    // Проходим весь HTML и заменяем все blob на нормальные пути
    for (const [path, blobUrl] of fileMap.entries()) {
      htmlText = htmlText.split(blobUrl).join(path);
    }

    // Сохраняем обновлённый HTML в ZIP
    zipData.file(indexFile, htmlText);

    const newZipBlob = await zipData.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(newZipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "updated_site.zip";
    a.click();
  };

  return (
    <Flex
      p={6}
      gap={6}
      minH="100vh"
      bg="gray.100"
      fontFamily="Inter, sans-serif"
    >
      {/* Левая панель: Просмотр сайта */}
      <Box
        flex={1}
        display="flex"
        flexDirection="column"
        bg="white"
        p={6}
        borderRadius="lg"
        shadow="xl"
      >
        <Heading size="lg" mb={6} color="gray.700">
          Просмотр сайта
        </Heading>

        {/* Кнопка загрузки */}
        <Input
          type="file"
          mb={4}
          onChange={handleFileUpload}
          w="100%"
          h="44px"
          sx={{
            display: "flex",
            alignItems: "center",
            borderRadius: "md",
            background: "gray.50",
            color: "gray.600",
            fontSize: "sm",
            cursor: "pointer",
            transition: "all 0.2s ease",
            overflow: "hidden",
            padding: "0",
            "&::file-selector-button": {
              height: "100%",
              margin: "0 20px 0 0",
              border: "none",
              background: "#3182CE",
              color: "white",
              padding: "0 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
              transition: "background 0.2s ease",
            },
            "&::file-selector-button:hover": {
              background: "#2B6CB0",
            },
            "&:hover": {
              borderColor: "#A0AEC0",
              background: "gray.100",
            },
          }}
        />

        {iframeUrl && (
          <Box
            flex={1}
            border="1px solid"
            borderColor="gray.200"
            borderRadius="md"
            overflow="hidden"
            shadow="md"
          >
            <iframe
              ref={iframeRef}
              src={iframeUrl}
              style={{ width: "100%", height: "70vh", border: "none" }}
              sandbox="allow-same-origin allow-scripts allow-forms"
            />
          </Box>
        )}
      </Box>

      {/* Правая панель: Редактор */}
      <Box
        w="320px"
        p={6}
        bg="white"
        borderRadius="lg"
        shadow="xl"
        overflowY="auto"
      >
        <VStack align="stretch" spacing={5}>
          <Heading size="md" color="gray.700">
            Редактор элемента
          </Heading>
          <Divider />

          {selectedEl ? (
            <>
              {selectedEl.tagName.toLowerCase() !== "img" && (
                <Box>
                  <Text fontSize="sm" color="gray.500" mb={1}>
                    Текст элемента:
                  </Text>
                  <Textarea
                    value={textValue}
                    onChange={handleTextChange}
                    size="md"
                    borderRadius="md"
                    focusBorderColor="blue.400"
                    mb={4}
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

                  {attr.name === "src" &&
                  selectedEl.tagName.toLowerCase() === "img" ? (
                    <Box flex={1}>
                      <Image
                        src={attr.blobUrl || attr.value}
                        maxH="60px"
                        mb={2}
                        borderRadius="md"
                        shadow="sm"
                      />
                      <Input
                        type="file"
                        size="sm"
                        onChange={handleImageChange}
                        borderRadius="md"
                        cursor="pointer"
                      />
                    </Box>
                  ) : (
                    <Input
                      size="sm"
                      value={attr.value}
                      onChange={(e) => handleAttrChange(index, e.target.value)}
                      borderRadius="md"
                      focusBorderColor="blue.400"
                    />
                  )}
                </HStack>
              ))}

              <Button
                colorScheme="blue"
                mt={3}
                w="full"
                borderRadius="md"
                shadow="sm"
                _hover={{ bg: "blue.500" }}
                onClick={handleDownload}
              >
                Скачать ZIP
              </Button>
            </>
          ) : (
            <Text fontSize="sm" color="gray.400" mt={2}>
              Выберите элемент в iframe
            </Text>
          )}
        </VStack>
      </Box>
    </Flex>
  );
}
