import React, { useMemo, useState } from 'react';
import { CheckIcon, ClipboardIcon } from '../ui/Icons';
import type { TrendAiCitationRecord } from '../../services/trendzContextualAiService';
import { sanitizeExternalUrl } from '../../utils/urlSanitizer';

interface TrendzAiMarkdownProps {
  content: string;
  citations?: TrendAiCitationRecord[];
  onSelectCitation?: (citationId: string) => void;
}

export interface InlineMarkdownOptions {
  citationsById?: Map<string, TrendAiCitationRecord>;
  onSelectCitation?: (citationId: string) => void;
  depth?: number;
}

const CodeCopyButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {
        // Ignore clipboard denial silently
      });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2 py-1 border border-zinc-800 bg-[#0c0c0e] text-[11px] font-mono text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white whitespace-nowrap shrink-0"
      aria-label={copied ? 'Code copied' : 'Copy code block'}
    >
      {copied ? (
        <>
          <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <ClipboardIcon className="w-3.5 h-3.5 text-zinc-400" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
};

/**
 * Safely renders inline Markdown formatting (bold, italic, inline code, safe external links,
 * and server-validated inline citation markers like [S1] / [E1]) using React elements only
 * (never raw HTML injection).
 */
export function renderInlineMarkdownNodes(
  text: string,
  options?: InlineMarkdownOptions
): React.ReactNode[] {
  const depth = options?.depth ?? 0;
  const tokenRegex =
    /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\)|\[[SER]\d+\])/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2);
      return (
        <strong key={idx} className="font-semibold text-white">
          {depth < 1 && options?.citationsById
            ? renderInlineMarkdownNodes(inner, { ...options, depth: depth + 1 })
            : inner}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      const inner = part.slice(1, -1);
      return (
        <em key={idx} className="italic text-zinc-200">
          {depth < 1 && options?.citationsById
            ? renderInlineMarkdownNodes(inner, { ...options, depth: depth + 1 })
            : inner}
        </em>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-[12px] break-words"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const label = linkMatch[1];
      const safeUrl = sanitizeExternalUrl(linkMatch[2]);
      if (!safeUrl) {
        return (
          <span key={idx} className="text-zinc-300">
            {label}
          </span>
        );
      }
      return (
        <a
          key={idx}
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-100 underline decoration-zinc-500 underline-offset-2 hover:text-white hover:decoration-white break-words"
        >
          {label}
        </a>
      );
    }

    const citationMatch = part.match(/^\[([SER]\d+)\]$/);
    if (citationMatch) {
      const citationId = citationMatch[1];
      const citation = options?.citationsById?.get(citationId);
      if (citation) {
        const isEditorial = citation.sourceType === 'editorial_briefing';
        const isRelatedTrend = citation.sourceType === 'related_trend_source';
        const roleLabel = isEditorial
          ? 'INVOX editorial briefing'
          : isRelatedTrend
            ? citation.isSimulated
              ? 'Sample related trend'
              : 'Related trend source'
            : citation.isSimulated
              ? 'Sample source evidence'
              : 'Publisher source';
        const titleText = `${part} ${citation.publisher} — ${citation.sourceTitle} (${roleLabel})`;
        const interactiveClass = isEditorial
          ? 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white hover:border-zinc-500'
          : isRelatedTrend
            ? 'border-amber-700/80 bg-zinc-950 text-amber-200 hover:bg-amber-200 hover:text-black hover:border-amber-200'
            : 'border-zinc-600 bg-zinc-900 text-white hover:bg-white hover:text-black hover:border-white';
        const staticClass = isEditorial
          ? 'border-zinc-700 bg-zinc-950 text-zinc-300'
          : isRelatedTrend
            ? 'border-amber-700/80 bg-zinc-950 text-amber-200'
            : 'border-zinc-600 bg-zinc-900 text-white';

        if (options?.onSelectCitation) {
          return (
            <button
              key={idx}
              type="button"
              onClick={() => options.onSelectCitation?.(citationId)}
              title={titleText}
              aria-label={`Inspect citation ${citationId}: ${citation.publisher}`}
              className={`inline-flex items-center align-baseline mx-0.5 px-1 py-0.25 font-mono text-[10px] leading-tight border transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white ${interactiveClass}`}
            >
              {part}
            </button>
          );
        }

        return (
          <span
            key={idx}
            title={titleText}
            className={`inline-flex items-center align-baseline mx-0.5 px-1 py-0.25 font-mono text-[10px] leading-tight border ${staticClass}`}
          >
            {part}
          </span>
        );
      }
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Safe editorial Markdown renderer for Trendz Contextual AI responses.
 * Supports headings, paragraphs, unordered & ordered lists, fenced code blocks,
 * blockquotes, horizontal dividers, sanitized external links, and verified inline citations.
 */
const TrendzAiMarkdown: React.FC<TrendzAiMarkdownProps> = ({
  content,
  citations,
  onSelectCitation,
}) => {
  const inlineOptions = useMemo<InlineMarkdownOptions>(() => {
    const map = new Map<string, TrendAiCitationRecord>();
    if (Array.isArray(citations)) {
      for (const c of citations) {
        if (c && c.id) {
          map.set(c.id, c);
        }
      }
    }
    return {
      citationsById: map.size > 0 ? map : undefined,
      onSelectCitation,
    };
  }, [citations, onSelectCitation]);

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];

  let activeList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeLines: string[] = [];
  let quoteLines: string[] = [];

  const flushList = () => {
    if (!activeList) return;
    const ListTag = activeList.type;
    blocks.push(
      <ListTag
        key={`list-${blocks.length}`}
        className={`${
          ListTag === 'ul' ? 'list-disc' : 'list-decimal'
        } list-outside pl-5 space-y-1.5 my-2.5 text-sm leading-relaxed text-zinc-200 font-sans`}
      >
        {activeList.items}
      </ListTag>
    );
    activeList = null;
  };

  const flushQuote = () => {
    if (quoteLines.length === 0) return;
    const combined = quoteLines.join(' ');
    blocks.push(
      <blockquote
        key={`quote-${blocks.length}`}
        className="my-2.5 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 text-zinc-300 text-sm leading-relaxed italic font-sans"
      >
        {renderInlineMarkdownNodes(combined, inlineOptions)}
      </blockquote>
    );
    quoteLines = [];
  };

  const flushCodeBlock = () => {
    if (codeLines.length === 0 && !inCodeBlock) return;
    const codeText = codeLines.join('\n');
    const cleanLang = codeLanguage.replace(/[^a-zA-Z0-9_+#.-]/g, '').slice(0, 24);
    blocks.push(
      <div
        key={`code-${blocks.length}`}
        className="my-3 border border-zinc-800 bg-black overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#09090b] border-b border-zinc-800">
          <span className="font-mono text-[11px] text-zinc-400">
            {cleanLang || 'Code'}
          </span>
          <CodeCopyButton code={codeText} />
        </div>
        <pre className="p-3.5 overflow-x-auto text-xs leading-relaxed font-mono text-zinc-200">
          <code>{codeText}</code>
        </pre>
      </div>
    );
    codeLines = [];
    codeLanguage = '';
  };

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushList();
        flushQuote();
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      return;
    }

    if (trimmed === '') {
      flushList();
      flushQuote();
      return;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushList();
      quoteLines.push(quoteMatch[1]);
      return;
    }
    flushQuote();

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const headingClasses: Record<number, string> = {
        1: 'text-base font-semibold text-white mt-4 mb-2 pb-1.5 border-b border-zinc-800 font-sans',
        2: 'text-[15px] font-semibold text-white mt-4 mb-1.5 font-sans',
        3: 'text-sm font-semibold text-zinc-100 mt-3 mb-1 font-sans',
        4: 'text-sm font-medium text-zinc-200 mt-2.5 mb-1 font-sans',
        5: 'text-xs font-semibold text-zinc-300 mt-2 mb-1 font-mono',
        6: 'text-xs font-medium text-zinc-400 mt-2 mb-1 font-mono',
      };
      const cls = headingClasses[level] || headingClasses[3];
      if (level === 1) {
        blocks.push(
          <h3 key={`h-${index}`} className={cls}>
            {renderInlineMarkdownNodes(headingText, inlineOptions)}
          </h3>
        );
      } else if (level === 2) {
        blocks.push(
          <h4 key={`h-${index}`} className={cls}>
            {renderInlineMarkdownNodes(headingText, inlineOptions)}
          </h4>
        );
      } else {
        blocks.push(
          <h5 key={`h-${index}`} className={cls}>
            {renderInlineMarkdownNodes(headingText, inlineOptions)}
          </h5>
        );
      }
      return;
    }

    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      flushList();
      blocks.push(<hr key={`hr-${index}`} className="border-zinc-800 my-3.5" />);
      return;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (activeList?.type !== 'ul') {
        flushList();
        activeList = { type: 'ul', items: [] };
      }
      activeList.items.push(
        <li key={`li-${index}`} className="leading-relaxed">
          {renderInlineMarkdownNodes(ulMatch[1], inlineOptions)}
        </li>
      );
      return;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (activeList?.type !== 'ol') {
        flushList();
        activeList = { type: 'ol', items: [] };
      }
      activeList.items.push(
        <li key={`li-${index}`} className="leading-relaxed">
          {renderInlineMarkdownNodes(olMatch[1], inlineOptions)}
        </li>
      );
      return;
    }

    flushList();
    blocks.push(
      <p
        key={`p-${index}`}
        className="text-sm leading-relaxed text-zinc-200 font-sans my-2 first:mt-0 last:mb-0"
      >
        {renderInlineMarkdownNodes(trimmed, inlineOptions)}
      </p>
    );
  });

  flushList();
  flushQuote();
  if (inCodeBlock) {
    flushCodeBlock();
  }

  return <div className="space-y-1 break-words">{blocks}</div>;
};

export default TrendzAiMarkdown;

