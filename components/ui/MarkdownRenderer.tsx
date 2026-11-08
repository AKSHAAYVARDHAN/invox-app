import React from 'react';

interface MarkdownRendererProps {
    content?: string | null;
    className?: string;
    isCollapsed?: boolean;
    maxPreviewChars?: number;
    onToggleExpand?: () => void;
}

/**
 * Sanitizes URLs to prevent javascript: and data: XSS attacks.
 */
const getSafeHref = (url: string): string | null => {
    try {
        const trimmed = url.trim();
        if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || trimmed.startsWith('/')) {
            return trimmed;
        }
    } catch {
        // invalid URL
    }
    return null;
};

/**
 * Parses inline Markdown elements (bold, italic, code, links, auto-URLs)
 * and returns safe React nodes. Never uses dangerouslySetInnerHTML.
 */
export const parseInlineMarkdown = (text: string): React.ReactNode => {
    if (!text) return null;

    // Tokenize text with regex matching inline elements in priority order:
    // 1. Markdown link: [text](url)
    // 2. Bold italic: ***text*** or ___text___
    // 3. Bold: **text** or __text__
    // 4. Italic: *text* or _text_
    // 5. Inline code: `code`
    // 6. Bare URL: https://... or http://...
    const inlineRegex = /(\[(.*?)\]\((.*?)\)|\*\*\*(.*?)\*\*\*|___(.*?)___|\*\*(.*?)\*\*|__(.*?)__|\*(.*?)\*|_(.*?)_|`([^`]+)`|(?:https?:\/\/[^\s<>"']+))/g;

    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = inlineRegex.exec(text)) !== null) {
        const matchIndex = match.index;
        // Text before match
        if (matchIndex > lastIndex) {
            nodes.push(text.slice(lastIndex, matchIndex));
        }

        const fullMatch = match[0];

        // 1. Markdown link [text](url)
        if (match[1] && match[2] !== undefined && match[3] !== undefined) {
            const linkText = match[2];
            const linkUrl = match[3];
            const safeHref = getSafeHref(linkUrl);
            if (safeHref) {
                nodes.push(
                    <a
                        key={`link-${matchIndex}`}
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors cursor-pointer"
                    >
                        {parseInlineMarkdown(linkText)}
                    </a>
                );
            } else {
                nodes.push(linkText);
            }
        }
        // 2. Bold Italic ***text*** or ___text___
        else if (match[4] !== undefined || match[5] !== undefined) {
            const content = match[4] ?? match[5];
            nodes.push(
                <strong key={`bi-${matchIndex}`} className="font-semibold text-white">
                    <em className="italic text-zinc-100">{content}</em>
                </strong>
            );
        }
        // 3. Bold **text** or __text__
        else if (match[6] !== undefined || match[7] !== undefined) {
            const content = match[6] ?? match[7];
            nodes.push(
                <strong key={`b-${matchIndex}`} className="font-semibold text-white">
                    {parseInlineMarkdown(content)}
                </strong>
            );
        }
        // 4. Italic *text* or _text_
        else if (match[8] !== undefined || match[9] !== undefined) {
            const content = match[8] ?? match[9];
            nodes.push(
                <em key={`i-${matchIndex}`} className="italic text-zinc-200">
                    {parseInlineMarkdown(content)}
                </em>
            );
        }
        // 5. Inline code `code`
        else if (match[10] !== undefined) {
            const code = match[10];
            nodes.push(
                <code
                    key={`code-${matchIndex}`}
                    className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-amber-300 font-mono text-[11px] rounded-none inline-block align-baseline"
                >
                    {code}
                </code>
            );
        }
        // 6. Bare URL
        else if (fullMatch.startsWith('http://') || fullMatch.startsWith('https://')) {
            const safeHref = getSafeHref(fullMatch);
            if (safeHref) {
                nodes.push(
                    <a
                        key={`url-${matchIndex}`}
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:text-sky-300 underline underline-offset-2 break-all inline-block"
                    >
                        {fullMatch}
                    </a>
                );
            } else {
                nodes.push(fullMatch);
            }
        } else {
            nodes.push(fullMatch);
        }

        lastIndex = matchIndex + fullMatch.length;
    }

    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }

    return nodes;
};

interface BlockItem {
    type: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'ul' | 'ol' | 'blockquote' | 'code' | 'hr';
    content?: string;
    items?: string[];
    language?: string;
}

/**
 * Parses multi-line Markdown text into structured blocks.
 */
const parseMarkdownBlocks = (rawText: string): BlockItem[] => {
    const lines = rawText.split(/\r?\n/);
    const blocks: BlockItem[] = [];

    let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
    let currentParagraph: string[] = [];
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockLines: string[] = [];

    const flushParagraph = () => {
        if (currentParagraph.length > 0) {
            blocks.push({
                type: 'p',
                content: currentParagraph.join('\n'),
            });
            currentParagraph = [];
        }
    };

    const flushList = () => {
        if (currentList && currentList.items.length > 0) {
            blocks.push({
                type: currentList.type,
                items: currentList.items,
            });
            currentList = null;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Handle code blocks ```
        if (trimmed.startsWith('```')) {
            if (inCodeBlock) {
                blocks.push({
                    type: 'code',
                    content: codeBlockLines.join('\n'),
                    language: codeBlockLang,
                });
                inCodeBlock = false;
                codeBlockLang = '';
                codeBlockLines = [];
            } else {
                flushParagraph();
                flushList();
                inCodeBlock = true;
                codeBlockLang = trimmed.slice(3).trim();
                codeBlockLines = [];
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockLines.push(line);
            continue;
        }

        // Horizontal rule
        if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
            flushParagraph();
            flushList();
            blocks.push({ type: 'hr' });
            continue;
        }

        // Blank line separates paragraphs/lists
        if (!trimmed) {
            flushParagraph();
            flushList();
            continue;
        }

        // Headings
        const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            const level = headingMatch[1].length;
            const headingType = level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4';
            blocks.push({
                type: headingType,
                content: headingMatch[2].trim(),
            });
            continue;
        }

        // Blockquotes
        if (trimmed.startsWith('>')) {
            flushParagraph();
            flushList();
            const quoteContent = trimmed.replace(/^>\s*/, '');
            blocks.push({
                type: 'blockquote',
                content: quoteContent,
            });
            continue;
        }

        // Unordered lists (- , * , + )
        const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
        if (bulletMatch) {
            flushParagraph();
            if (!currentList || currentList.type !== 'ul') {
                flushList();
                currentList = { type: 'ul', items: [] };
            }
            currentList.items.push(bulletMatch[1].trim());
            continue;
        }

        // Ordered lists (1. , 2. )
        const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
        if (orderedMatch) {
            flushParagraph();
            if (!currentList || currentList.type !== 'ol') {
                flushList();
                currentList = { type: 'ol', items: [] };
            }
            currentList.items.push(orderedMatch[1].trim());
            continue;
        }

        // Standard text paragraph line
        flushList();
        currentParagraph.push(trimmed);
    }

    if (inCodeBlock && codeBlockLines.length > 0) {
        blocks.push({
            type: 'code',
            content: codeBlockLines.join('\n'),
            language: codeBlockLang,
        });
    }

    flushParagraph();
    flushList();

    return blocks;
};

/**
 * Full-fidelity Markdown Renderer adhering to INVOX dark theme and frontend typography rules.
 * Headings are sized proportionally without disrupting card containers.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
    content,
    className = '',
    isCollapsed = false,
    maxPreviewChars = 320,
    onToggleExpand,
}) => {
    if (!content) return null;

    const blocks = parseMarkdownBlocks(content);

    // If collapsed, filter blocks so we don't render an overwhelming wall of text,
    // while ensuring each preview block is fully closed and valid!
    let displayBlocks = blocks;
    let isTruncated = false;

    if (isCollapsed) {
        let accumulatedChars = 0;
        const previewBlocks: BlockItem[] = [];

        for (const block of blocks) {
            const blockLength = (block.content?.length || 0) + (block.items?.reduce((a, b) => a + b.length, 0) || 0);
            previewBlocks.push(block);
            accumulatedChars += blockLength;

            if (accumulatedChars >= maxPreviewChars || previewBlocks.length >= 3) {
                isTruncated = true;
                break;
            }
        }

        // If there are more blocks than what we chose for preview, show truncated state
        if (blocks.length > previewBlocks.length || content.length > maxPreviewChars + 40) {
            displayBlocks = previewBlocks;
            isTruncated = true;
        } else {
            isTruncated = false;
        }
    }

    return (
        <div className={`space-y-2.5 font-sans text-zinc-300 leading-relaxed ${className}`}>
            {displayBlocks.map((block, idx) => {
                switch (block.type) {
                    case 'h1':
                        return (
                            <h2
                                key={`h1-${idx}`}
                                className="text-base sm:text-lg font-bold text-white tracking-tight mt-3 mb-1.5 first:mt-0 font-sans"
                            >
                                {parseInlineMarkdown(block.content || '')}
                            </h2>
                        );
                    case 'h2':
                        return (
                            <h3
                                key={`h2-${idx}`}
                                className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight mt-2.5 mb-1.5 first:mt-0 font-sans"
                            >
                                {parseInlineMarkdown(block.content || '')}
                            </h3>
                        );
                    case 'h3':
                        return (
                            <h4
                                key={`h3-${idx}`}
                                className="text-xs sm:text-[13px] font-semibold text-zinc-200 font-mono uppercase tracking-wider mt-3 mb-1.5 first:mt-0 flex items-center gap-1.5"
                            >
                                <span className="text-zinc-500 font-mono text-[10px]">//</span>
                                <span>{parseInlineMarkdown(block.content || '')}</span>
                            </h4>
                        );
                    case 'h4':
                        return (
                            <h5
                                key={`h4-${idx}`}
                                className="text-xs font-semibold text-zinc-200 font-mono uppercase tracking-wider mt-2 mb-1 first:mt-0"
                            >
                                {parseInlineMarkdown(block.content || '')}
                            </h5>
                        );
                    case 'p':
                        return (
                            <p
                                key={`p-${idx}`}
                                className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal whitespace-pre-line"
                            >
                                {parseInlineMarkdown(block.content || '')}
                            </p>
                        );
                    case 'ul':
                        return (
                            <ul
                                key={`ul-${idx}`}
                                className="space-y-1.5 my-2 pl-4 list-disc marker:text-zinc-500 text-xs sm:text-sm text-zinc-300 leading-relaxed"
                            >
                                {block.items?.map((item, itemIdx) => (
                                    <li key={`li-${itemIdx}`} className="pl-1">
                                        {parseInlineMarkdown(item)}
                                    </li>
                                ))}
                            </ul>
                        );
                    case 'ol':
                        return (
                            <ol
                                key={`ol-${idx}`}
                                className="space-y-1.5 my-2 pl-4 list-decimal marker:text-zinc-500 font-sans text-xs sm:text-sm text-zinc-300 leading-relaxed"
                            >
                                {block.items?.map((item, itemIdx) => (
                                    <li key={`oli-${itemIdx}`} className="pl-1">
                                        {parseInlineMarkdown(item)}
                                    </li>
                                ))}
                            </ol>
                        );
                    case 'blockquote':
                        return (
                            <blockquote
                                key={`bq-${idx}`}
                                className="border-l-2 border-zinc-700 bg-zinc-950/60 pl-3.5 py-1.5 my-2 text-zinc-300 italic text-xs sm:text-sm leading-relaxed"
                            >
                                {parseInlineMarkdown(block.content || '')}
                            </blockquote>
                        );
                    case 'code':
                        return (
                            <pre
                                key={`pre-${idx}`}
                                className="p-3 bg-zinc-950 border border-zinc-850 font-mono text-xs text-zinc-250 overflow-x-auto my-2"
                            >
                                <code>{block.content}</code>
                            </pre>
                        );
                    case 'hr':
                        return <hr key={`hr-${idx}`} className="border-t border-zinc-850 my-3" />;
                    default:
                        return null;
                }
            })}

            {/* Read Full Record / Show Less Toggle Button */}
            {onToggleExpand && (
                <div className="pt-1">
                    {isCollapsed && isTruncated && (
                        <button
                            type="button"
                            onClick={onToggleExpand}
                            className="inline-flex items-center gap-1 text-white hover:text-zinc-200 underline underline-offset-4 font-mono uppercase text-[11px] font-semibold cursor-pointer"
                        >
                            <span>Read Full Record</span>
                            <span className="text-[10px]">→</span>
                        </button>
                    )}
                    {!isCollapsed && content.length > maxPreviewChars && (
                        <button
                            type="button"
                            onClick={onToggleExpand}
                            className="inline-flex items-center gap-1 text-zinc-400 hover:text-white font-mono uppercase text-[10px] cursor-pointer"
                        >
                            <span>Show Less</span>
                            <span className="text-[9px]">▲</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default MarkdownRenderer;
