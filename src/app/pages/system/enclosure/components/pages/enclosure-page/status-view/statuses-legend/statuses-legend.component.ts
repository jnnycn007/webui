import {
  ChangeDetectionStrategy, Component, computed, input,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { chain } from 'lodash';
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
  readonly slots = input.required<DashboardEnclosureSlot[]>();

  protected readonly legend = computed(() => {
    const statuses = chain(this.slots())
      .filter((slot) => Boolean(slot.pool_info))
      .map((slot) => slot.pool_info.disk_status)
      .uniq()
      .value();

    return statuses.map((status) => {
      const statusLabel = enclosureDiskStatusLabels.has(status) ? enclosureDiskStatusLabels.get(status) : status;
      return [
        this.translate.instant(statusLabel),
        getDiskStatusColor(status),
      ];
    });
  });

  constructor(
    private translate: TranslateService,
  ) {}
}
