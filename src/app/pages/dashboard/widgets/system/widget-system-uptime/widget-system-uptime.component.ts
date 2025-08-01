import { ChangeDetectionStrategy, Component, computed, input, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { LocaleService } from 'app/modules/language/locale.service';
import { WithLoadingStateDirective } from 'app/modules/loader/directives/with-loading-state/with-loading-state.directive';
import { WidgetResourcesService } from 'app/pages/dashboard/services/widget-resources.service';
import { WidgetComponent } from 'app/pages/dashboard/types/widget-component.interface';
import {
  SlotSize,
} from 'app/pages/dashboard/types/widget.interface';
import { WidgetDatapointComponent } from 'app/pages/dashboard/widgets/common/widget-datapoint/widget-datapoint.component';
import { UptimePipe } from 'app/pages/dashboard/widgets/system/common/uptime.pipe';
import { systemUptimeWidget } from 'app/pages/dashboard/widgets/system/widget-system-uptime/widget-system-uptime.definition';

@Component({
  selector: 'ix-widget-system-uptime',
  templateUrl: './widget-system-uptime.component.html',
  styleUrls: ['./widget-system-uptime.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    WithLoadingStateDirective,
    WidgetDatapointComponent,
    TranslateModule,
    UptimePipe,
  ],
})
export class WidgetSystemUptimeComponent implements WidgetComponent {
  private resources = inject(WidgetResourcesService);
  private localeService = inject(LocaleService);

  size = input.required<SlotSize>();
  readonly name = systemUptimeWidget.name;

  systemInfo$ = this.resources.dashboardSystemInfo$;

  loadedSystemInfo = toSignal(this.systemInfo$.pipe(
    map((state) => state.value),
    filter((value) => !!value),
  ));

  startTime = Date.now();

  realElapsedSeconds = toSignal(this.resources.refreshInterval$.pipe(
    map(() => {
      return Math.floor((Date.now() - this.startTime) / 1000);
    }),
  ), { requireSync: true });

  uptime = computed(() => {
    return Number(this.loadedSystemInfo()?.uptime_seconds) + this.realElapsedSeconds();
  });

  datetime = computed(() => {
    this.realElapsedSeconds();
    const [, timeValue] = this.localeService.getDateAndTime();
    return `${timeValue.split(':')[0]}:${timeValue.split(':')[1]}`;
  });
}
