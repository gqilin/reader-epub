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

  setCustomCSS(css: string): void {
    this.customCss = css;
  }

  buildContentStyles(): string {
    const t = this.theme;
    let css = '';

    // Base reset
    css += `
      :host {
        display: block;
        position: relative;
      }
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
        height: auto;
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

    // Body-only rules (background, padding — should not cascade to children)
    if (t.backgroundColor) bodyRules.push(`background-color: ${t.backgroundColor}`);

    // Padding
    if (t.padding) {
      if (typeof t.padding === 'number') {
        bodyRules.push(`padding: ${t.padding}px`);
      } else {
        bodyRules.push(
          `padding: ${t.padding.top}px ${t.padding.right}px ${t.padding.bottom}px ${t.padding.left}px`
        );
      }
    } else {
      bodyRules.push('padding: 24px 16px');
    }

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

  buildPaginationStyles(columnWidth: number, gap: number, height: number): string {
    return `
      .epub-body {
        height: ${height}px;
        column-width: ${columnWidth}px;
        column-gap: ${gap}px;
        column-fill: auto;
        overflow: hidden;
        box-sizing: border-box;
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
