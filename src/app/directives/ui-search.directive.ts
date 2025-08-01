import { Directive, ElementRef, Renderer2, OnInit, OnDestroy, input, inject } from '@angular/core';
import { Timeout } from 'app/interfaces/timeout.interface';
import { searchDelayConst } from 'app/modules/global-search/constants/delay.const';
import { getSearchableElementId } from 'app/modules/global-search/helpers/get-searchable-element-id';
import { UiSearchableElement } from 'app/modules/global-search/interfaces/ui-searchable-element.interface';
import { UiSearchDirectivesService } from 'app/modules/global-search/services/ui-search-directives.service';

@Directive({
  selector: '[ixUiSearch]',
})
export class UiSearchDirective implements OnInit, OnDestroy {
  private renderer = inject(Renderer2);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private searchDirectives = inject(UiSearchDirectivesService);

  readonly config = input.required<UiSearchableElement>({
    alias: 'ixUiSearch',
  });

  get id(): string {
    return getSearchableElementId(this.config());
  }

  get ariaLabel(): string {
    const hierarchy = this.config().hierarchy;
    const hierarchyItem = (hierarchy ? hierarchy[hierarchy.length - 1] : '') || '';
    const isSingleWord = hierarchyItem.trim().split(/\s+/).length === 1;

    const synonyms = this.config().synonyms;
    if (isSingleWord && synonyms && Number(synonyms?.length) > 0) {
      return synonyms.reduce((best, synonym) => {
        const synonymWordCount = synonym.trim().split(/\s+/).length;
        const bestWordCount = best.trim().split(/\s+/).length;
        return synonymWordCount > bestWordCount ? synonym : best;
      }, hierarchyItem);
    }
    return hierarchyItem;
  }

  private highlightTimeout: Timeout | null = null;

  ngOnInit(): void {
    if (this.id) {
      this.renderer.setAttribute(this.elementRef.nativeElement, 'id', this.id);
      this.renderer.setAttribute(this.elementRef.nativeElement, 'aria-label', this.ariaLabel);
    }
    this.searchDirectives.register(this);
  }

  ngOnDestroy(): void {
    this.searchDirectives.unregister(this);
  }

  highlight(parentElement: UiSearchableElement): void {
    this.tryHighlightAnchors(parentElement, 0);
  }

  private tryHighlightAnchors(element: UiSearchableElement, attemptCount: number): void {
    if (this.elementRef.nativeElement) {
      setTimeout(() => {
        const anchorRef = document.getElementById(this.elementRef.nativeElement.id) || this.elementRef.nativeElement;
        this.highlightAndClickElement(anchorRef, !!element.triggerAnchor);
      }, searchDelayConst);

      if (element.anchor && this.elementRef.nativeElement.id !== element.anchor) {
        this.highlightElementAnchor(element.anchor);
      }
    } else if (attemptCount < 2) {
      setTimeout(() => this.tryHighlightAnchors(element, attemptCount + 1), searchDelayConst * 3);
    }
  }

  private highlightElementAnchor(elementAnchor: string): void {
    setTimeout(() => {
      const rootNode = this.elementRef.nativeElement.getRootNode() as HTMLElement;
      const anchorRef: HTMLElement | null = rootNode?.querySelector(`#${elementAnchor}`);

      if (anchorRef) {
        this.highlightAndClickElement(anchorRef);
      }
    }, searchDelayConst * 1.5);
  }

  private highlightAndClickElement(anchorRef: HTMLElement, shouldClick = false): void {
    if (shouldClick && anchorRef) setTimeout(() => anchorRef.click(), searchDelayConst);

    if (!anchorRef || shouldClick) return;

    this.renderer.addClass(anchorRef, 'search-element-highlighted');

    const removeHighlightStyling = (): void => {
      this.renderer.removeClass(anchorRef, 'search-element-highlighted');
      ['click', 'keydown'].forEach((event) => document.removeEventListener(event, removeHighlightStyling));
    };

    setTimeout(() => {
      anchorRef.focus();
      anchorRef.scrollIntoView();
      document.querySelector<HTMLElement>('.rightside-content-hold')?.scrollBy(0, -20);
      ['click', 'keydown'].forEach((event) => document.addEventListener(event, removeHighlightStyling, { once: true }));
    }, searchDelayConst);

    if (this.highlightTimeout) {
      clearTimeout(this.highlightTimeout);
    }

    this.highlightTimeout = setTimeout(() => removeHighlightStyling(), 4000);
  }
}
