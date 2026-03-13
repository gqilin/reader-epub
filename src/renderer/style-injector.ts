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

    // Theme properties
    const bodyRules: string[] = [];

    if (t.fontFamily) bodyRules.push(`font-family: ${t.fontFamily}`);
    if (t.fontSize) bodyRules.push(`font-size: ${t.fontSize}px`);
    if (t.fontWeight) bodyRules.push(`font-weight: ${t.fontWeight}`);
    if (t.color) bodyRules.push(`color: ${t.color}`);
    if (t.backgroundColor) bodyRules.push(`background-color: ${t.backgroundColor}`);
    if (t.lineHeight) {
      const lh = typeof t.lineHeight === 'number' ? `${t.lineHeight}` : t.lineHeight;
      bodyRules.push(`line-height: ${lh}`);
    }
    if (t.letterSpacing) {
      const ls = typeof t.letterSpacing === 'number'
        ? `${t.letterSpacing}px`
        : t.letterSpacing;
      bodyRules.push(`letter-spacing: ${ls}`);
    }
    if (t.textAlign) bodyRules.push(`text-align: ${t.textAlign}`);

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
      css += `.epub-body p { margin-bottom: ${t.paragraphSpacing}px; }`;
    }

    // Link color
    if (t.linkColor) {
      css += `.epub-body a { color: ${t.linkColor}; }`;
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
