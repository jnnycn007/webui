import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { map } from 'rxjs/operators';
import { GaugeConfig, ViewChartGaugeComponent } from 'app/modules/charts/view-chart-gauge/view-chart-gauge.component';
import { WidgetResourcesService } from 'app/pages/dashboard/services/widget-resources.service';

@Component({
  selector: 'ix-cpu-chart-gauge',
  templateUrl: './cpu-chart-gauge.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxSkeletonLoaderModule, ViewChartGaugeComponent],
})
export class CpuChartGaugeComponent {
  private resources = inject(WidgetResourcesService);
  private translate = inject(TranslateService);

  protected cpuData = toSignal(this.resources.realtimeUpdates$.pipe(
    map((update) => update.fields.cpu),
  ));

  protected isLoading = computed(() => !this.cpuData());

  protected cpuAvg: Signal<GaugeConfig> = computed(() => {
    const cpuData = this.cpuData();
    const data = ['Load', cpuData ? parseInt(cpuData.cpu.usage.toFixed(1)) : 0];
    return {
      label: false,
      data,
      units: '%',
      diameter: 136,
      fontSize: 28,
      max: 100,
      subtitle: this.translate.instant('Avg Usage'),
    };
  });
}
