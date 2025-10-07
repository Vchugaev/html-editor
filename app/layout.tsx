"use client";

import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import { ReactNode } from "react";
import { theme } from "./theme";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <ChakraProvider theme={theme}>{children}</ChakraProvider>
      </body>
    </html>
  );
}
