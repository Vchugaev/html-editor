"use client";

import { useEffect, useState } from "react";
import { AttributeItem } from "../types/editor";

export function useIframeSelection(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  activationKey: string | null
) {
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [textValue, setTextValue] = useState("");
  const [attributes, setAttributes] = useState<AttributeItem[]>([]);

  const normalizeHtmlForEditor = (html: string) =>
    html
      .replace(/\n|\r|\t/g, " ")
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      const handleHover = (e: MouseEvent) => {
        const el = e.target as HTMLElement;
        if (el !== selectedElement) {
          el.style.outline = "2px dashed #A0AEC0";
          el.style.outlineOffset = "2px";
        }
      };

      const handleLeave = (e: MouseEvent) => {
        const el = e.target as HTMLElement;
        if (el !== selectedElement) {
          el.style.outline = "";
        }
      };

      const handleClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const el = e.target as HTMLElement;

        if (selectedElement && selectedElement !== el) {
          selectedElement.style.outline = "";
        }

        // Ensure element has a persistent editor id
        if (!el.getAttribute("data-editor-id")) {
          const uid = `e${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          el.setAttribute("data-editor-id", uid);
        }

        el.style.outline = "2px solid #3182CE";
        el.style.outlineOffset = "2px";

        setSelectedElement(el);
        setTextValue(normalizeHtmlForEditor(el.innerHTML));
        const rawAttrs = Array.from(el.attributes);
        const filteredAttrs: AttributeItem[] = [];
        for (const attr of rawAttrs) {
          if (attr.name.toLowerCase() === "style") {
            const cleaned = attr.value
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean)
              .filter((decl) => {
                const prop = decl.split(":")[0]?.trim().toLowerCase();
                return prop !== "outline" && prop !== "outline-offset";
              })
              .join("; ");
            if (cleaned) {
              filteredAttrs.push({ name: attr.name, value: cleaned });
            }
          } else {
            filteredAttrs.push({ name: attr.name, value: attr.value });
          }
        }
        setAttributes(filteredAttrs);
      };

      doc.addEventListener("click", handleClick);
      doc.addEventListener("mouseover", handleHover);
      doc.addEventListener("mouseout", handleLeave);
    };

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
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

  return {
    selectedElement,
    textValue,
    attributes,
    updateText,
    updateAttribute,
    setAttributes,
  } as const;
}

