/**
 * RIFT — Lightweight Markdown renderer for the legal document page.
 */
(function initRoyalArmiesLegalDocument(global) {
    'use strict';

    const DEFAULT_MARKDOWN_PATH = 'legal/terms-document.md';

    function escapeLegalHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderInlineMarkdown(text) {
        let html = escapeLegalHtml(text);
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
            const safeHref = String(href || '').trim();
            const safeLabel = String(label || '').trim();
            if (!/^https?:\/\//i.test(safeHref) && !safeHref.startsWith('/') && !safeHref.startsWith('#')) {
                return safeLabel;
            }
            const external = /^https?:\/\//i.test(safeHref);
            return `<a href="${escapeLegalHtml(safeHref)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeLegalHtml(safeLabel)}</a>`;
        });
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        return html;
    }

    function slugifyLegalHeading(title) {
        return String(title || '')
            .toLowerCase()
            .replace(/&amp;/g, 'and')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function flushParagraph(buffer, output) {
        const text = buffer.join(' ').trim();
        if (!text) return;
        output.push(`<p>${renderInlineMarkdown(text)}</p>`);
        buffer.length = 0;
    }

    function renderLegalMarkdown(markdown) {
        const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
        const output = [];
        const paragraphBuffer = [];
        let listOpen = false;

        function closeList() {
            if (!listOpen) return;
            output.push('</ul>');
            listOpen = false;
        }

        lines.forEach((rawLine) => {
            const line = rawLine.trimEnd();
            const trimmed = line.trim();

            if (!trimmed) {
                flushParagraph(paragraphBuffer, output);
                closeList();
                return;
            }

            if (/^#{1,6}\s+/.test(trimmed)) {
                flushParagraph(paragraphBuffer, output);
                closeList();
                const level = Math.min(6, trimmed.match(/^#+/)[0].length);
                const title = trimmed.replace(/^#{1,6}\s+/, '');
                const headingId = slugifyLegalHeading(title);
                output.push(
                    `<h${level}${headingId ? ` id="${escapeLegalHtml(headingId)}"` : ''}>${renderInlineMarkdown(title)}</h${level}>`
                );
                return;
            }

            if (/^>\s?/.test(trimmed)) {
                flushParagraph(paragraphBuffer, output);
                closeList();
                output.push(`<blockquote><p>${renderInlineMarkdown(trimmed.replace(/^>\s?/, ''))}</p></blockquote>`);
                return;
            }

            if (/^[-*]\s+/.test(trimmed)) {
                flushParagraph(paragraphBuffer, output);
                if (!listOpen) {
                    output.push('<ul>');
                    listOpen = true;
                }
                output.push(`<li>${renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</li>`);
                return;
            }

            if (/^\d+\.\s+/.test(trimmed)) {
                flushParagraph(paragraphBuffer, output);
                closeList();
                output.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
                return;
            }

            paragraphBuffer.push(trimmed);
        });

        flushParagraph(paragraphBuffer, output);
        closeList();

        return output.join('\n');
    }

    function scrollToLegalHashTarget() {
        const hash = String(global.location.hash || '').trim();
        if (!hash || hash.length < 2) return;
        const target = global.document.querySelector(hash);
        if (target) {
            target.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
    }

    async function loadLegalDocumentInto(rootEl, markdownPath) {
        if (!rootEl) return;

        const path = markdownPath || rootEl.getAttribute('data-legal-markdown') || DEFAULT_MARKDOWN_PATH;
        rootEl.setAttribute('aria-busy', 'true');
        rootEl.innerHTML = '<p class="legal-document-loading">Loading legal document…</p>';

        try {
            const response = await fetch(path, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const markdown = await response.text();
            rootEl.innerHTML = renderLegalMarkdown(markdown);
            scrollToLegalHashTarget();
        } catch (error) {
            console.error('[RIFT] Legal document load failed:', error);
            rootEl.innerHTML = (
                '<p class="legal-document-error">'
                + 'The legal document could not be loaded. '
                + 'Please refresh the page or contact <a href="mailto:accountsdept@royalarmies.com">accountsdept@royalarmies.com</a>.'
                + '</p>'
            );
        } finally {
            rootEl.removeAttribute('aria-busy');
        }
    }

    function bootLegalDocumentPage() {
        const root = global.document.getElementById('legal-document-root');
        if (!root) return;
        loadLegalDocumentInto(root);
    }

    global.RoyalArmiesLegalDocument = {
        renderLegalMarkdown,
        loadLegalDocumentInto
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootLegalDocumentPage);
    } else {
        bootLegalDocumentPage();
    }
})(window);
