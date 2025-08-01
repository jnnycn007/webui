import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, OnDestroy, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { map } from 'rxjs/operators';
import { LayoutService } from 'app/modules/layout/layout.service';
import { PageTitleService } from 'app/modules/layout/page-title.service';
import { FakeProgressBarComponent } from 'app/modules/loader/components/fake-progress-bar/fake-progress-bar.component';
import { BreadcrumbComponent } from 'app/modules/page-header/breadcrumb/breadcrumb.component';
import { HeaderBadgeComponent } from 'app/modules/page-header/header-badge/header-badge.component';
import { TooltipComponent } from 'app/modules/tooltip/tooltip.component';

/**
 * Usage:
 * Use in your template to override default page title.
 * If you don't use this component, the default page title will be shown.
 */
@Component({
  selector: 'ix-page-header',
  templateUrl: './page-header.component.html',
  styleUrls: ['./page-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BreadcrumbComponent,
    HeaderBadgeComponent,
    FakeProgressBarComponent,
    TranslateModule,
    AsyncPipe,
    TooltipComponent,
  ],
})
export class PageHeaderComponent implements OnInit, OnDestroy {
  private pageTitleService = inject(PageTitleService);
  private layoutService = inject(LayoutService);

  readonly pageTitle = input<string>();
  readonly customBadgeTitle = input<string>();
  readonly tooltip = input<string>();
  readonly loading = input(false);

  /**
   * You probably don't need to use this.
   * Set to true for automatic header when no header is set.
   */
  readonly default = input(false);

  readonly defaultTitle$ = this.pageTitleService.title$;
  readonly hasNewIndicator$ = this.pageTitleService.hasNewIndicator$;
  readonly currentTitle$ = this.defaultTitle$.pipe(
    map((defaultTitle) => {
      if (!this.pageTitle()) {
        return defaultTitle;
      }

      return this.pageTitle();
    }),
  );

  ngOnInit(): void {
    if (!this.default()) {
      this.layoutService.hasCustomPageHeader$.next(true);
    }
  }

  ngOnDestroy(): void {
    if (!this.default()) {
      this.layoutService.hasCustomPageHeader$.next(false);
    }
  }
}
