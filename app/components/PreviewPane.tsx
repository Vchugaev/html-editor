"use client";

import { Box, Heading, Input, useColorModeValue } from "@chakra-ui/react";
import { RefObject } from "react";

interface PreviewPaneProps {
  onUpload: (file: File) => void;
  iframeUrl: string | null;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

export default function PreviewPane({ onUpload, iframeUrl, iframeRef }: PreviewPaneProps) {
  const panelBg = useColorModeValue("white", "gray.800");
  const headingColor = useColorModeValue("gray.700", "gray.100");
  const borderColor = useColorModeValue("gray.200", "whiteAlpha.300");
  const fileBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const fileHoverBg = useColorModeValue("gray.100", "whiteAlpha.200");
  const fileHoverBorder = useColorModeValue("#A0AEC0", "whiteAlpha.400");

  return (
    <Box
      flex={1}
      display="flex"
      flexDirection="column"
      bg={panelBg}
      p={6}
      borderRadius="lg"
      shadow="xl"
      overflowY="auto"
    >
      <Heading size="lg" mb={6} color={headingColor}>
        Просмотр сайта
      </Heading>

      <Input
        type="file"
        mb={4}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }}
        w="100%"
        h="44px"
        sx={{
          display: "flex",
          alignItems: "center",
          borderRadius: "md",
          background: fileBg,
          color: "gray.300",
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
            borderColor: fileHoverBorder,
            background: fileHoverBg,
          },
        }}
      />

      {iframeUrl && (
        <Box
          flex={1}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="md"
          overflow="hidden"
          shadow="md"
        >
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        </Box>
      )}
    </Box>
  );
}

