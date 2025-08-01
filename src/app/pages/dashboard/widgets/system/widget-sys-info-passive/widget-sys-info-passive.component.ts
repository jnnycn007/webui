import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatList, MatListItem } from '@angular/material/list';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import {
  filter, map,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { helptextSystemFailover } from 'app/helptext/system/failover';
import { getLabelForContractType } from 'app/interfaces/system-info.interface';
import { CopyButtonComponent } from 'app/modules/buttons/copy-button/copy-button.component';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { selectUpdateJobForPassiveNode } from 'app/modules/jobs/store/job.selectors';
import { LocaleService } from 'app/modules/language/locale.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { WidgetResourcesService } from 'app/pages/dashboard/services/widget-resources.service';
import { SlotSize } from 'app/pages/dashboard/types/widget.interface';
import { ProductImageComponent } from 'app/pages/dashboard/widgets/system/common/product-image/product-image.component';
import { UptimePipe } from 'app/pages/dashboard/widgets/system/common/uptime.pipe';
import { getSystemVersion } from 'app/pages/dashboard/widgets/system/common/widget-sys-info.utils';
import { AppState } from 'app/store';
import { selectCanFailover, selectIsHaEnabled, selectIsHaLicensed } from 'app/store/ha-info/ha-info.selectors';
import {
  selectIsIxHardware, selectIsEnterprise, selectHasEnclosureSupport,
} from 'app/store/system-info/system-info.selectors';

@UntilDestroy()
@Component({
  selector: 'ix-widget-sys-info-passive',
  templateUrl: './widget-sys-info-passive.component.html',
  styleUrls: ['../common/widget-sys-info.scss', './widget-sys-info-passive.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatCardContent,
    IxIconComponent,
    ProductImageComponent,
    MatButton,
    TestDirective,
    RequiresRolesDirective,
    MatTooltip,
    MatList,
    MatListItem,
    NgxSkeletonLoaderModule,
    CopyButtonComponent,
    TranslateModule,
    UptimePipe,
    NgTemplateOutlet,
  ],
})
export class WidgetSysInfoPassiveComponent {
  private resources = inject(WidgetResourcesService);
  private dialog = inject(DialogService);
  private store$ = inject<Store<AppState>>(Store);
  private router = inject(Router);
  private localeService = inject(LocaleService);
  private translate = inject(TranslateService);

  size = input.required<SlotSize>();

  protected readonly requiredRoles = [Role.FailoverWrite];

  canFailover = toSignal(this.store$.select(selectCanFailover));
  isIxHardware = toSignal(this.store$.select(selectIsIxHardware));
  isEnterprise = toSignal(this.store$.select(selectIsEnterprise));
  isHaLicensed = toSignal(this.store$.select(selectIsHaLicensed));
  isHaEnabled = toSignal(this.store$.select(selectIsHaEnabled));
  hasEnclosureSupport = toSignal(this.store$.select(selectHasEnclosureSupport));
  isUpdateRunning = toSignal(this.store$.select(selectUpdateJobForPassiveNode));
  protected readonly getLabelForContractType = getLabelForContractType;

  updateAvailable = toSignal(this.resources.updateAvailable$);
  systemInfo = toSignal(this.resources.dashboardSystemInfo$.pipe(
    map((state) => state.value?.remote_info),
    filter((value) => !!value),
  ));

  startTime = Date.now();

  realElapsedSeconds = toSignal(this.resources.refreshInterval$.pipe(
    map(() => {
      return Math.floor((Date.now() - this.startTime) / 1000);
    }),
  ), { requireSync: true });

  isWaitingForEnabledHa = computed(() => !this.systemInfo() && !this.canFailover() && !this.isHaEnabled());
  version = computed(() => getSystemVersion(this.systemInfo().version, this.systemInfo().codename));
  uptime = computed(() => this.systemInfo().uptime_seconds + this.realElapsedSeconds());
  datetime = computed(() => {
    this.realElapsedSeconds();
    const [, timeValue] = this.localeService.getDateAndTime();
    return `${timeValue.split(':')[0]}:${timeValue.split(':')[1]}`;
  });

  isLoaded = computed(() => this.systemInfo());

  constructor() {
    effect(() => {
      if (!this.systemInfo() && this.canFailover()) {
        this.resources.refreshDashboardSystemInfo();
      }
    });
  }

  openDialog(): void {
    this.dialog.confirm({
      title: this.translate.instant(helptextSystemFailover.failoverDialogTitle),
      message: this.translate.instant(helptextSystemFailover.failoverDialogMessage),
      buttonText: this.translate.instant(helptextSystemFailover.failoverButton),
    }).pipe(
      filter(Boolean),
      untilDestroyed(this),
    ).subscribe(() => {
      this.router.navigate(['/system-tasks/failover'], { skipLocationChange: true });
    });
  }

  protected readonly iconMarker = iconMarker;
}
