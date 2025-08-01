import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, output, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { debounceTime, take } from 'rxjs';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { IxSlideToggleComponent } from 'app/modules/forms/ix-forms/components/ix-slide-toggle/ix-slide-toggle.component';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { reportingGlobalControlsElements } from 'app/pages/reports-dashboard/components/reports-global-controls/reports-global-controls.elements';
import { ReportTab, ReportType } from 'app/pages/reports-dashboard/interfaces/report-tab.interface';
import { ReportsService } from 'app/pages/reports-dashboard/reports.service';
import { AppState } from 'app/store';
import { autoRefreshReportsToggled } from 'app/store/preferences/preferences.actions';
import { waitForPreferences } from 'app/store/preferences/preferences.selectors';

@UntilDestroy()
@Component({
  selector: 'ix-reports-global-controls',
  templateUrl: './reports-global-controls.component.html',
  styleUrls: ['./reports-global-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IxSelectComponent,
    IxSlideToggleComponent,
    MatButton,
    TestDirective,
    MatMenuTrigger,
    UiSearchDirective,
    IxIconComponent,
    MatMenu,
    NgTemplateOutlet,
    MatMenuItem,
    TranslateModule,
    RouterLink,
  ],
})
export class ReportsGlobalControlsComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private store$ = inject<Store<AppState>>(Store);
  private reportsService = inject(ReportsService);
  private cdr = inject(ChangeDetectorRef);

  readonly diskOptionsChanged = output<{ devices: string[]; metrics: string[] }>();

  protected form = this.fb.group({
    autoRefresh: [false],
    devices: [[] as string[]],
    metrics: [[] as string[]],
  });

  protected activeTab: ReportTab | undefined;
  protected allTabs: ReportTab[];
  protected diskDevices$ = this.reportsService.getDiskDevices();
  protected diskMetrics$ = this.reportsService.getDiskMetrics();

  protected readonly ReportType = ReportType;
  protected readonly searchableElements = reportingGlobalControlsElements;

  ngOnInit(): void {
    this.setupTabs();
    this.setAutoRefreshControl();
    this.setupDisksTab();
  }

  protected isActiveTab(tab: ReportTab): boolean {
    return this.activeTab?.value === tab.value;
  }

  protected typeTab(tab: ReportTab): ReportTab {
    return tab;
  }

  private setupTabs(): void {
    this.reportsService.getReportGraphs()
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        this.allTabs = this.reportsService.getReportTabs();
        this.activeTab = this.allTabs.find((tab) => {
          return tab.value === (this.route.routeConfig?.path as ReportType);
        });
        this.cdr.markForCheck();
      });
  }

  private setupDisksTab(): void {
    if (this.activeTab?.value !== ReportType.Disk) {
      return;
    }
    this.form.valueChanges.pipe(debounceTime(300), untilDestroyed(this)).subscribe((values) => {
      this.diskOptionsChanged.emit({
        devices: values.devices || [],
        metrics: values.metrics || [],
      });
    });
    this.diskDevices$.pipe(untilDestroyed(this)).subscribe((disks) => {
      const disksNames = this.route.snapshot.queryParams.disks as string[] | string;
      let devices: string[];
      if (disksNames) {
        devices = Array.isArray(disksNames) ? disksNames : [disksNames];
      } else {
        devices = disks.map((device) => String(device.value));
      }
      this.form.patchValue({ devices });
    });
    this.diskMetrics$.pipe(untilDestroyed(this)).subscribe((metrics) => {
      this.form.patchValue({ metrics: metrics.map((device) => String(device.value)) });
    });
  }

  private setAutoRefreshControl(): void {
    this.store$.pipe(
      waitForPreferences,
      take(1),
      untilDestroyed(this),
    ).subscribe((preferences) => {
      this.form.patchValue({ autoRefresh: preferences.autoRefreshReports });
      this.form.controls.autoRefresh.valueChanges.pipe(
        untilDestroyed(this),
      ).subscribe(() => {
        this.store$.dispatch(autoRefreshReportsToggled());
      });
    });
  }
}
