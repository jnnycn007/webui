import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, ChangeDetectionStrategy, OnInit, ElementRef, ChangeDetectorRef, AfterViewInit, OnDestroy, Signal, viewChild, DOCUMENT, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { isEqual } from 'lodash-es';
import {
  tap, debounceTime, filter, switchMap,
  combineLatestWith,
  distinctUntilChanged,
} from 'rxjs';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { GlobalSearchResultsComponent } from 'app/modules/global-search/components/global-search-results/global-search-results.component';
import { searchDelayConst } from 'app/modules/global-search/constants/delay.const';
import { extractVersion } from 'app/modules/global-search/helpers/extract-version';
import { moveToNextFocusableElement, moveToPreviousFocusableElement } from 'app/modules/global-search/helpers/focus-helper';
import { UiSearchableElement } from 'app/modules/global-search/interfaces/ui-searchable-element.interface';
import { GlobalSearchSectionsProvider } from 'app/modules/global-search/services/global-search-sections.service';
import { UiSearchDirectivesService } from 'app/modules/global-search/services/ui-search-directives.service';
import { UiSearchProvider } from 'app/modules/global-search/services/ui-search.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { SidenavService } from 'app/modules/layout/sidenav.service';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { FocusService } from 'app/services/focus.service';
import { AppState } from 'app/store';
import { waitForSystemInfo } from 'app/store/system-info/system-info.selectors';

@UntilDestroy()
@Component({
  selector: 'ix-global-search',
  templateUrl: './global-search.component.html',
  styleUrls: ['./global-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkTrapFocus,
    IxIconComponent,
    MatInput,
    ReactiveFormsModule,
    TestDirective,
    GlobalSearchResultsComponent,
    TranslateModule,
  ],
})
export class GlobalSearchComponent implements OnInit, AfterViewInit, OnDestroy {
  protected sidenavService = inject(SidenavService);
  private searchProvider = inject(UiSearchProvider);
  private searchDirectives = inject(UiSearchDirectivesService);
  private globalSearchSectionsProvider = inject(GlobalSearchSectionsProvider);
  private cdr = inject(ChangeDetectorRef);
  private store$ = inject<Store<AppState>>(Store);
  private slideIn = inject(SlideIn);
  private dialogService = inject(DialogService);
  private focusService = inject(FocusService);
  private document = inject<Document>(DOCUMENT);

  searchInput: Signal<ElementRef<HTMLInputElement>> = viewChild.required('searchInput', { read: ElementRef });
  searchBoxWrapper: Signal<ElementRef<HTMLElement>> = viewChild.required('searchBoxWrapper', { read: ElementRef });

  searchControl = new FormControl<string>('', { nonNullable: true });
  searchResults: UiSearchableElement[];
  isLoading = false;
  systemVersion: string;
  detachOverlay: () => void; // passed from global-search-trigger

  get isSearchInputFocused(): boolean {
    return this.document.activeElement === this.searchInput()?.nativeElement;
  }

  ngOnInit(): void {
    this.getSystemVersion();
    this.listenForSelectionChanges();
    this.listenForSearchChanges();
    this.setInitialSearchResults();
  }

  ngAfterViewInit(): void {
    this.searchBoxWrapper().nativeElement.addEventListener('focusout', this.handleFocusOut);
  }

  ngOnDestroy(): void {
    this.searchBoxWrapper().nativeElement.removeEventListener('focusout', this.handleFocusOut);
  }

  handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'Tab':
        event.preventDefault();

        if (event.key === 'Tab') {
          this.handleTabOutFromGlobalSearch(event);
        }

        if (!event.shiftKey) {
          if (this.isSearchInputFocused) moveToNextFocusableElement(this.document);
          moveToNextFocusableElement(this.document);
        }

        if (event.shiftKey && event.key === 'Tab') {
          moveToPreviousFocusableElement(this.document);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveToPreviousFocusableElement(this.document);
        break;
      case 'Enter':
        event.preventDefault();

        if (this.isSearchInputFocused) {
          moveToNextFocusableElement(this.document);
          (this.document.activeElement as HTMLElement)?.click();
        }
        break;
      default:
        if (event.key.length === 1 && !event.metaKey && !this.isSearchInputFocused) {
          event.preventDefault();
          this.searchControl.setValue(this.searchControl.value + event.key);
          this.focusInputElement();
        }
        break;
    }
  }

  resetInput(): void {
    this.searchControl.setValue('');
  }

  setInitialSearchResults(): void {
    this.searchResults = this.globalSearchSectionsProvider.getRecentSearchesSectionResults();
  }

  closeAllBackdrops(): void {
    this.slideIn.closeAll();
    this.sidenavService.closeSecondaryMenu();
    this.dialogService.closeAllDialogs();
  }

  private listenForSearchChanges(): void {
    this.searchControl.valueChanges.pipe(
      tap((value) => {
        this.isLoading = !!value;
        if (!value) {
          this.setInitialSearchResults();
        }
      }),
      debounceTime(searchDelayConst),
      filter(Boolean),
      switchMap((term) => this.globalSearchSectionsProvider.getUiSectionResults(term)),
      untilDestroyed(this),
    ).subscribe((searchResults) => {
      this.searchResults = [
        ...searchResults,
        ...this.globalSearchSectionsProvider.getHelpSectionResults(
          this.searchControl.value,
          extractVersion(this.systemVersion),
        ),
      ];
      this.isLoading = false;
      this.cdr.markForCheck();
    });
  }

  private focusInputElement(): void {
    this.searchInput().nativeElement?.focus();
  }

  private getSystemVersion(): void {
    this.store$.pipe(
      waitForSystemInfo,
      untilDestroyed(this),
    )
      .subscribe((systemInfo) => {
        this.systemVersion = systemInfo.version;
      });
  }

  private listenForSelectionChanges(): void {
    this.searchProvider.selectionChanged$.pipe(
      tap((config) => {
        if (!this.searchDirectives.get(config)) {
          this.searchDirectives.setPendingUiHighlightElement(config);
        }
      }),
      combineLatestWith(this.searchDirectives.directiveAdded$.pipe(filter(Boolean))),
      filter(([config]) => !!this.searchDirectives.get(config)),
      distinctUntilChanged(([prevConfig], [nextConfig]) => isEqual(prevConfig, nextConfig)),
      untilDestroyed(this),
    ).subscribe(([config]) => {
      this.resetInput();
      this.searchDirectives.setPendingUiHighlightElement(null);
      this.searchDirectives.get(config)?.highlight(config);
      this.closeAllBackdrops();
    });
  }

  private handleTabOutFromGlobalSearch(event: KeyboardEvent): void {
    const focusableElements = this.focusService.getFocusableElements(this.searchBoxWrapper().nativeElement);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      this.detachOverlay();
      setTimeout(() => {
        this.focusService.focusFirstFocusableElement(this.document.querySelector('mat-toolbar-row'));
      });
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      this.detachOverlay();
      setTimeout(() => {
        this.focusService.focusFirstFocusableElement(document.querySelector('.topbar-mobile-footer'));
      });
    }
  }

  private handleFocusOut = (event: FocusEvent): void => {
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget && !this.searchBoxWrapper().nativeElement.contains(relatedTarget)) {
      this.detachOverlay();
    }
  };
}
