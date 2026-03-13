export interface PaginationState {
  currentPage: number;
  totalPages: number;
  pageWidth: number;
}

export class Paginator {
  private body: HTMLElement | null = null;
  private gap: number;
  private state: PaginationState = {
    currentPage: 0,
    totalPages: 1,
    pageWidth: 0,
  };

  constructor(gap = 40) {
    this.gap = gap;
  }

  apply(body: HTMLElement, containerWidth: number, _containerHeight: number): PaginationState {
    this.body = body;

    const pageWidth = containerWidth;
    this.state.pageWidth = pageWidth + this.gap;

    // Let the browser layout with columns, then measure
    requestAnimationFrame(() => {
      this.recalculate();
    });

    // Initial calculation
    this.recalculate();
    return this.state;
  }

  recalculate(): PaginationState {
    if (!this.body) return this.state;

    const scrollWidth = this.body.scrollWidth;
    const pageWidth = this.state.pageWidth;
    this.state.totalPages = Math.max(1, Math.ceil(scrollWidth / pageWidth));

    if (this.state.currentPage >= this.state.totalPages) {
      this.state.currentPage = this.state.totalPages - 1;
    }
    return this.state;
  }

  goToPage(page: number): boolean {
    if (!this.body) return false;
    if (page < 0 || page >= this.state.totalPages) return false;

    this.state.currentPage = page;
    const offset = page * this.state.pageWidth;
    this.body.style.transform = `translateX(-${offset}px)`;
    return true;
  }

  nextPage(): boolean {
    return this.goToPage(this.state.currentPage + 1);
  }

  prevPage(): boolean {
    return this.goToPage(this.state.currentPage - 1);
  }

  get current(): PaginationState {
    return { ...this.state };
  }

  get columnGap(): number {
    return this.gap;
  }
}
