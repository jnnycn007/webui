import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { Component, ChangeDetectionStrategy, AfterViewInit, signal, ChangeDetectorRef, input, DOCUMENT, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { DetailsHeightDirective } from 'app/directives/details-height/details-height.directive';
import { MobileBackButtonComponent } from 'app/modules/buttons/mobile-back-button/mobile-back-button.component';
import { FocusService } from 'app/services/focus.service';

@UntilDestroy()
@Component({
  selector: 'ix-master-detail-view',
  templateUrl: './master-detail-view.component.html',
  styleUrls: ['./master-detail-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DetailsHeightDirective,
    MobileBackButtonComponent,
    TranslateModule,
  ],
  exportAs: 'masterDetailViewContext',
})
export class MasterDetailViewComponent<T> implements AfterViewInit {
  private breakpointObserver = inject(BreakpointObserver);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private focusService = inject(FocusService);
  private document = inject<Document>(DOCUMENT);

  readonly selectedItem = input<T | null>(null);
  readonly showDetails = input<boolean | null>(true);
  readonly showMobileDetails = signal<boolean>(false);
  readonly isMobileView = signal<boolean>(false);

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationStart), untilDestroyed(this))
      .subscribe(() => {
        if (this.router.getCurrentNavigation()?.extras?.state?.hideMobileDetails) {
          this.toggleShowMobileDetails(false);
        }
      });
  }

  ngAfterViewInit(): void {
    this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium])
      .pipe(untilDestroyed(this))
      .subscribe((state: BreakpointState) => {
        if (state.matches) {
          this.isMobileView.set(true);
        } else {
          this.isMobileView.set(false);
          this.toggleShowMobileDetails(false);
        }
        this.cdr.markForCheck();
      });
  }

  toggleShowMobileDetails(value: boolean): void {
    this.showMobileDetails.set(value);

    setTimeout(() => {
      if (value) {
        this.focusService.focusElementById('mobile-back-button');
      } else {
        this.focusService.focusFirstFocusableElement(this.document.querySelector('main'));
      }
    });
  }
}
