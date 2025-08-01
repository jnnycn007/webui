import { ChangeDetectionStrategy, Component, computed, input, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { uniq } from 'lodash-es';
import { enclosureDiskStatusLabels } from 'app/enums/enclosure-slot-status.enum';
import { DashboardEnclosureSlot } from 'app/interfaces/enclosure.interface';
import { getDiskStatusColor } from 'app/pages/system/enclosure/utils/disk-status-tint.utils';

@Component({
  selector: 'ix-statuses-legend',
  templateUrl: './statuses-legend.component.html',
  styleUrls: ['./statuses-legend.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusesLegendComponent {
  private translate = inject(TranslateService);

  readonly slots = input.required<DashboardEnclosureSlot[]>();

  protected readonly legend = computed(() => {
    const slots = this.slots();
    const slotsWithPool = slots.filter((slot) => Boolean(slot.pool_info));
    const statuses = uniq(slotsWithPool.map((slot) => slot.pool_info?.disk_status));

    return statuses
      .filter((status) => status !== undefined)
      .map((status) => {
        const statusLabel = enclosureDiskStatusLabels.get(status) || status;
        return [
          this.translate.instant(statusLabel),
          getDiskStatusColor(status),
        ];
      });
  });
}
