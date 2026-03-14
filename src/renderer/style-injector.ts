import type { ReaderTheme } from '../types/renderer';

export class StyleInjector {
  private theme: ReaderTheme = {};
  private customCss = '';

  setTheme(theme: ReaderTheme): void {
    this.theme = { ...theme };
  }

  updateTheme(partial: Partial<ReaderTheme>): void {
    Object.assign(this.theme, partial);
  }

  getTheme(): ReaderTheme {
    return { ...this.theme };
  }

  getContentPadding(): { top: number; right: number; bottom: number; left: number } {
    const t = this.theme;
    if (t.padding) {
      if (typeof t.padding === 'number') {
        return { top: t.padding, right: t.padding, bottom: t.padding, left: t.padding };
      }
      return { top: t.padding.top, right: t.padding.right, bottom: t.padding.bottom, left: t.padding.left };
    }
    return { top: 24, right: 16, bottom: 24, left: 16 };
  }

  setCustomCSS(css: string): void {
    this.customCss = css;
  }

  buildContentStyles(): string {
    const t = this.theme;
    let css = '';

    // Base reset — padding on :host (wrapper) so it doesn't affect column pagination
    const pad = this.getContentPadding();
    const hostRules: string[] = [
      'display: block',
      'position: relative',
      'box-sizing: border-box',
      `padding: ${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px !important`,
    ];
    if (t.backgroundColor) hostRules.push(`background-color: ${t.backgroundColor}`);

    css += `:host { ${hostRules.join('; ')}; }`;
    css += `
      .epub-body {
        margin: 0;
        word-wrap: break-word;
        overflow-wrap: break-word;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      .epub-body img,
      .epub-body svg,
      .epub-body video {
        max-width: 100%;
        max-height: 100%;
      }
    `;

    // Reader theme overrides — must beat book CSS that directly styles p, span, h1, etc.
    // Use ".epub-body, .epub-body *" with !important for readable properties,
    // so they apply directly to every element (not just inherited from container).
    const overrideRules: string[] = [];
    const bodyRules: string[] = [];

    if (t.fontFamily) overrideRules.push(`font-family: ${t.fontFamily} !important`);
    if (t.fontSize) overrideRules.push(`font-size: ${t.fontSize}px !important`);
    if (t.fontWeight) overrideRules.push(`font-weight: ${t.fontWeight} !important`);
    if (t.color) overrideRules.push(`color: ${t.color} !important`);
    if (t.lineHeight) {
      const lh = typeof t.lineHeight === 'number' ? `${t.lineHeight}` : t.lineHeight;
      overrideRules.push(`line-height: ${lh} !important`);
    }
    if (t.letterSpacing) {
      const ls = typeof t.letterSpacing === 'number'
        ? `${t.letterSpacing}px`
        : t.letterSpacing;
      overrideRules.push(`letter-spacing: ${ls} !important`);
    }
    if (t.textAlign) overrideRules.push(`text-align: ${t.textAlign} !important`);

    if (overrideRules.length > 0) {
      css += `.epub-body, .epub-body * { ${overrideRules.join('; ')}; }`;
    }

    // Body-only rules (background — should not cascade to children)
    if (t.backgroundColor) bodyRules.push(`background-color: ${t.backgroundColor}`);

    if (bodyRules.length > 0) {
      css += `.epub-body { ${bodyRules.join('; ')}; }`;
    }

    // Paragraph spacing
    if (t.paragraphSpacing !== undefined) {
      css += `.epub-body p { margin-bottom: ${t.paragraphSpacing}px !important; }`;
    }

    // Link color
    if (t.linkColor) {
      css += `.epub-body a { color: ${t.linkColor} !important; }`;
    }

    // Image opacity (useful for dark themes)
    if (t.imageOpacity !== undefined) {
      css += `.epub-body img { opacity: ${t.imageOpacity}; }`;
    }

    // Custom CSS
    if (this.customCss) {
      css += this.customCss;
    }

    return css;
  }

  buildPaginationStyles(columnWidth: number, gap: number, height: number, spread = false): string {
    const ruleColor = this.theme.color ?? '#e0e0e0';
    const columnRule = spread
      ? `column-rule: 1px solid color-mix(in srgb, ${ruleColor} 15%, transparent);`
      : '';
    return `
      .epub-body {
        height: ${height}px;
        column-width: ${columnWidth}px;
        column-gap: ${gap}px;
        column-fill: auto;
        overflow: visible;
        box-sizing: border-box;
        ${columnRule}
      }
      /* Prevent wrappers with explicit height from creating blank columns */
      .epub-body > * {
        height: auto !important;
        min-height: 0 !important;
        box-sizing: border-box;
      }
      /* Remove edge margins inside containers to prevent column overflow */
      .epub-body > * > *:first-child { margin-top: 0 !important; }
      .epub-body > * > *:last-child  { margin-bottom: 0 !important; }
      /* Force images to auto-size within column bounds */
      .epub-body img {
        width: auto !important;
        height: auto !important;
        max-width: 100% !important;
        max-height: ${height}px !important;
      }
      /* Eliminate inline formatting gaps around standalone images:
         line-height/font-size: 0 kills the "strut" so the image box
         has zero extra pixels from the inline context. */
      .epub-body *:has(> img:only-child) {
        margin: 0 !important;
        padding: 0 !important;
        line-height: 0 !important;
        font-size: 0 !important;
      }
      /* Collapse spacing on the outer wrapper when it only contains
         a single image-wrapper child (e.g. div > p > img). */
      .epub-body > *:has(> *:only-child > img:only-child) {
        margin: 0 !important;
        padding: 0 !important;
      }
      /* SVG / video: constrain to column bounds */
      .epub-body svg,
      .epub-body video {
        max-width: 100% !important;
        max-height: ${height}px !important;
      }
    `;
  }

  buildScrolledStyles(): string {
    return `
      .epub-body {
        box-sizing: border-box;
      }
    `;
  }
}
