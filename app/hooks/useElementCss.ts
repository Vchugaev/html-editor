"use client";

import { useEffect, useRef, useState } from "react";

export interface CssPropItem {
  property: string;
  value: string;
}

function collectCssPropsForElement(el: HTMLElement, doc: Document): Record<string, string> {
  const result: Record<string, string> = {};
  const styleSheets = Array.from(doc.styleSheets) as CSSStyleSheet[];
  for (const sheet of styleSheets) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      // cross-origin or unreadable stylesheet, skip
      continue;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      if (rule.type === CSSRule.STYLE_RULE) {
        const styleRule = rule as CSSStyleRule;
        const selector = styleRule.selectorText;
        if (!selector) continue;
        // Only consider rules that actually match this element
        try {
          if (el.matches(selector)) {
            const style = styleRule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style.item(i);
              const val = style.getPropertyValue(prop);
              if (prop && val) {
                // later rules override earlier ones
                result[prop] = val.trim();
              }
            }
          }
        } catch {
          // invalid selector or not supported, ignore
        }
      }
    }
  }
  return result;
}

export function useElementCss(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  selectedElement: HTMLElement | null
) {
  const [cssProps, setCssProps] = useState<CssPropItem[]>([]);
  const idCounterRef = useRef<number>(1);

  // recompute CSS properties when selection changes
  useEffect(() => {
    if (!iframeRef.current || !selectedElement) {
      setCssProps([]);
      return;
    }
    const doc = iframeRef.current.contentDocument;
    if (!doc) {
      setCssProps([]);
      return;
    }
    const map = collectCssPropsForElement(selectedElement, doc);
    // Convert to sorted list for stable UI
    const entries = Object.entries(map)
      .filter(([prop]) => prop !== "outline" && prop !== "outline-offset")
      .sort(([a], [b]) => a.localeCompare(b));
    setCssProps(entries.map(([property, value]) => ({ property, value })));
  }, [iframeRef, selectedElement]);

  // Ensure overrides style and an empty rule for the selected element always exist
  useEffect(() => {
    if (!iframeRef.current || !selectedElement) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    const head = doc.head || doc.getElementsByTagName("head")[0];
    if (!head) return;
    const STYLE_ID = "editor-overrides";
    let styleEl = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = STYLE_ID;
      head.appendChild(styleEl);
    }
    try { head.appendChild(styleEl); } catch {}
    // assign id if missing
    let id = selectedElement.getAttribute("data-editor-id");
    if (!id) {
      id = `e${Date.now()}_${idCounterRef.current++}`;
      selectedElement.setAttribute("data-editor-id", id);
    }
    const selector = `[data-editor-id="${id}"]`;
    const sheet = styleEl.sheet as CSSStyleSheet | null;
    if (sheet) {
      try {
        let found = false;
        for (let i = 0; i < sheet.cssRules.length; i++) {
          const r = sheet.cssRules[i];
          if (r.type === CSSRule.STYLE_RULE && (r as CSSStyleRule).selectorText === selector) {
            found = true;
            break;
          }
        }
        if (!found) {
          sheet.insertRule(`${selector} {}`, sheet.cssRules.length);
        }
      } catch {
        // ignore
      }
    }
  }, [iframeRef, selectedElement]);

  const setCssProp = (property: string, value: string) => {
    if (!iframeRef.current || !selectedElement) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    // Ensure element has stable data-editor-id
    let id = selectedElement.getAttribute("data-editor-id");
    if (!id) {
      id = `e${Date.now()}_${idCounterRef.current++}`;
      selectedElement.setAttribute("data-editor-id", id);
    }

    // Ensure style tag exists
    const head = doc.head || doc.getElementsByTagName("head")[0];
    if (!head) return;
    const STYLE_ID = "editor-overrides";
    let styleEl = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = STYLE_ID;
      styleEl.appendChild(doc.createTextNode(""));
      head.appendChild(styleEl);
    }
    // Ensure overrides style is the last in <head> for max precedence
    try { head.appendChild(styleEl); } catch {}

    // Parse existing CSS from the style tag for this element
    const selector = `[data-editor-id="${id}"]`;
    const sheet = styleEl.sheet as CSSStyleSheet | null;
    let ruleIndex = -1;
    if (sheet) {
      try {
        for (let i = 0; i < sheet.cssRules.length; i++) {
          const r = sheet.cssRules[i];
          if (r.type === CSSRule.STYLE_RULE && (r as CSSStyleRule).selectorText === selector) {
            ruleIndex = i;
            break;
          }
        }
      } catch {
        // ignore
      }
    }

    if (ruleIndex === -1 && sheet) {
      try {
        sheet.insertRule(`${selector} {}`, sheet.cssRules.length);
        ruleIndex = sheet.cssRules.length - 1;
      } catch {
        // fallback: rewrite whole text
        styleEl.textContent = `${selector} { ${property}: ${value} !important; }\n` + (styleEl.textContent || "");
        // Update local state for UI
        setCssProps((prev) => {
          const map: Record<string, string> = {};
          for (const p of prev) map[p.property] = p.value;
          map[property] = value;
          return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => ({ property: k, value: v }));
        });
        return;
      }
    }

    if (sheet && ruleIndex !== -1) {
      const rule = sheet.cssRules[ruleIndex] as CSSStyleRule;
      try {
        rule.style.setProperty(property, value, "important");
      } catch {
        // ignore invalid property
      }
    }

    // Also mirror change inline to increase robustness and persistence
    try {
      selectedElement.style.setProperty(property, value);
    } catch {
      // ignore
    }

    // Update local UI state
    setCssProps((prev) => {
      const map: Record<string, string> = {};
      for (const p of prev) map[p.property] = p.value;
      map[property] = value;
      return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ property: k, value: v }));
    });
  };

  return { cssProps, setCssProp } as const;
}


