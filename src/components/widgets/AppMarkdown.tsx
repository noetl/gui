import React, { useMemo } from "react";
import type { AppMarkdownArgs, WidgetProps } from "./types";

// chatui's AppMarkdown uses react-markdown + remark-gfm + rehype-raw +
// a `<@user_id>` mention plugin. The noetl GUI has no react-markdown
// dependency, so we ship a small dependency-free subset instead. The
// `args.text` field name is preserved verbatim from chatui so playbook
// authors can copy-paste shapes between the two systems.
//
// Supported subset:
//   - Headings: #..######
//   - Paragraphs (blank-line separated)
//   - Unordered lists ("- " / "* "), ordered lists ("1. ")
//   - Fenced code blocks (triple backtick with optional language)
//   - Inline code, **bold**, *italic*/_italic_
//   - Links: [text](https://...)
//
// HTML in the source is escaped before formatting, so playbook output
// can never inject script tags.

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(line: string): string {
  let out = line;
  out = out.replace(/`([^`]+)`/g, (_, inner) => `<code>${inner}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, inner) => `<strong>${inner}</strong>`);
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, (_, prefix, inner) => `${prefix}<em>${inner}</em>`);
  out = out.replace(/(^|[^_])_([^_\n]+)_/g, (_, prefix, inner) => `${prefix}<em>${inner}</em>`);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  return out;
}

function renderBlocks(source: string): string {
  const escaped = escapeHtml(source);
  const lines = escaped.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      const lang = fence[1] || "";
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(
        `<pre class="noetl-widget-code"${lang ? ` data-lang="${lang}"` : ""}><code>${codeLines.join("\n")}</code></pre>`,
      );
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const paragraph: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim()
      && !/^(#{1,6})\s+/.test(lines[i])
      && !/^\s*[-*]\s+/.test(lines[i])
      && !/^\s*\d+\.\s+/.test(lines[i])
      && !/^```/.test(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }
  return out.join("\n");
}

export function AppMarkdown({ args }: WidgetProps<AppMarkdownArgs>) {
  const html = useMemo(() => renderBlocks(args?.text || ""), [args?.text]);
  return (
    <div
      className="noetl-widget noetl-widget-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
