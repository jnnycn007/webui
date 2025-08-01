import { ChangeDetectionStrategy, Component, computed, input, OnChanges, OnInit, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatCard, MatCardHeader, MatCardTitle, MatCardContent,
} from '@angular/material/card';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { PoolCardIconType } from 'app/enums/pool-card-icon-type.enum';
import { PoolStatus } from 'app/enums/pool-status.enum';
import { TopologyWarning, VDevType } from 'app/enums/v-dev-type.enum';
import { buildNormalizedFileSize } from 'app/helpers/file-size.utils';
import { Disk, StorageDashboardDisk } from 'app/interfaces/disk.interface';
import { Pool, PoolTopology } from 'app/interfaces/pool.interface';
import {
  EnclosureAndSlot,
  TopologyDisk,
  VDevItem,
} from 'app/interfaces/storage.interface';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { PoolCardIconComponent } from 'app/pages/storage/components/dashboard-pool/pool-card-icon/pool-card-icon.component';
import { vDevsCardElements } from 'app/pages/storage/components/dashboard-pool/vdevs-card/vdevs-card.elements';
import { StorageService } from 'app/services/storage.service';

interface TopologyState {
  data: string;
  metadata: string;
  log: string;
  cache: string;
  spare: string;
  dedup: string;
}

export type EmptyDiskObject = Record<
  string, string | number | boolean | string[] | EnclosureAndSlot
>;

@UntilDestroy()
@Component({
  selector: 'ix-vdevs-card',
  templateUrl: './vdevs-card.component.html',
  styleUrls: ['./vdevs-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    UiSearchDirective,
    MatCardHeader,
    MatCardTitle,
    PoolCardIconComponent,
    MatButton,
    TestDirective,
    MatCardContent,
    MatTooltip,
    IxIconComponent,
    TranslateModule,
  ],
})
export class VDevsCardComponent implements OnInit, OnChanges {
  router = inject(Router);
  translate = inject(TranslateService);
  storageService = inject(StorageService);

  readonly poolState = input.required<Pool>();
  readonly disks = input<StorageDashboardDisk[]>([]);

  protected readonly searchableElements = vDevsCardElements;
  notAssignedDev = this.translate.instant('VDEVs not assigned');

  topologyState: TopologyState = {
    data: this.notAssignedDev,
    metadata: this.notAssignedDev,
    log: this.notAssignedDev,
    cache: this.notAssignedDev,
    spare: this.notAssignedDev,
    dedup: this.notAssignedDev,
  };

  topologyWarningsState: TopologyState = { ...this.topologyState };

  protected iconType = computed(() => {
    if (this.isStatusError(this.poolState())) {
      return PoolCardIconType.Error;
    }
    if (this.isStatusWarning(this.poolState()) || !this.poolState().healthy) {
      return PoolCardIconType.Warn;
    }
    return PoolCardIconType.Safe;
  });

  protected iconTooltip = computed(() => {
    if (this.isStatusError(this.poolState()) || this.isStatusWarning(this.poolState())) {
      return this.translate.instant('Pool contains {status} Data VDEVs', { status: this.poolState().status });
    }
    if (!this.poolState().healthy) {
      return this.translate.instant('Pool is not healthy');
    }
    return this.translate.instant('Everything is fine');
  });

  readonly noOtherVdevTypes = computed(() => {
    const nonDataVdevs = [
      this.topologyState.metadata,
      this.topologyState.log,
      this.topologyState.cache,
      this.topologyState.spare,
      this.topologyState.dedup,
    ];

    const emptyCount = nonDataVdevs.filter((vdevType) => vdevType === this.notAssignedDev).length;

    return emptyCount >= 3;
  });

  get isDraidLayoutDataVdevs(): boolean {
    return /\bDRAID\b/.test(this.topologyState.data);
  }

  ngOnChanges(): void {
    this.parseTopology(this.poolState().topology);
  }

  ngOnInit(): void {
    this.parseTopology(this.poolState().topology);
  }

  parseTopology(topology: PoolTopology): void {
    if (!topology) {
      return;
    }

    this.topologyWarningsState.data = this.parseDevsWarnings(topology.data, VDevType.Data);
    this.topologyWarningsState.log = this.parseDevsWarnings(topology.log, VDevType.Log);
    this.topologyWarningsState.cache = this.parseDevsWarnings(topology.cache, VDevType.Cache);
    this.topologyWarningsState.spare = this.parseDevsWarnings(topology.spare, VDevType.Spare);
    this.topologyWarningsState.metadata = this.parseDevsWarnings(topology.special, VDevType.Special);
    this.topologyWarningsState.dedup = this.parseDevsWarnings(topology.dedup, VDevType.Dedup);

    this.topologyState.data = this.parseDevs(topology.data, VDevType.Data, this.topologyWarningsState.data);
    this.topologyState.log = this.parseDevs(topology.log, VDevType.Log, this.topologyWarningsState.log);
    this.topologyState.cache = this.parseDevs(topology.cache, VDevType.Cache, this.topologyWarningsState.cache);
    this.topologyState.spare = this.parseDevs(topology.spare, VDevType.Spare, this.topologyWarningsState.spare);
    this.topologyState.metadata = this.parseDevs(
      topology.special,
      VDevType.Special,
      this.topologyWarningsState.metadata,
    );
    this.topologyState.dedup = this.parseDevs(topology.dedup, VDevType.Dedup, this.topologyWarningsState.dedup);
  }

  private parseDevs(vdevs: VDevItem[], category: VDevType, warning?: string): string {
    let outputString = vdevs.length ? '' : this.notAssignedDev as string;

    // Check VDEV Widths
    let vdevWidth = 0;

    // There should only be one value
    const allVdevWidths: Set<number> = this.storageService.getVdevWidths(vdevs);
    const isMixedWidth = this.storageService.isMixedWidth(allVdevWidths);
    const isSingleDeviceCategory = [VDevType.Spare, VDevType.Cache].includes(category);

    if (!isMixedWidth && !isSingleDeviceCategory) {
      vdevWidth = Array.from(allVdevWidths.values())[0];
    }

    if (outputString && outputString === this.notAssignedDev) {
      return outputString;
    }

    const type = vdevs[0]?.type;
    const size = vdevs[0]?.children.length
      ? this.disks()?.find((disk) => disk.name === vdevs[0]?.children[0]?.disk)?.size
      : this.disks()?.find((disk) => disk.name === (vdevs[0] as TopologyDisk)?.disk)?.size;

    outputString = `${vdevs.length} x `;
    if (vdevWidth) {
      outputString += this.translate.instant('{type} | {vdevWidth} wide | ', { type, vdevWidth });
    }

    const isMixedVdevCapacity = warning?.includes(TopologyWarning.MixedVdevCapacity)
      || warning?.includes(TopologyWarning.MixedDiskCapacity);

    if (!isMixedVdevCapacity && size) {
      outputString += buildNormalizedFileSize(size);
    } else if (isMixedVdevCapacity) {
      outputString += this.translate.instant('Mixed Capacity');
    } else {
      outputString += '?';
    }

    return outputString;
  }

  private parseDevsWarnings(vdevs: VDevItem[], category: VDevType): string {
    let outputString = '';
    const disks: Disk[] = this.disks().map((disk: StorageDashboardDisk) => {
      return this.dashboardDiskToDisk(disk);
    });
    const warnings = this.storageService.validateVdevs(category, vdevs, disks);
    if (warnings.length === 1) {
      outputString = warnings[0];
    }
    if (warnings.length > 1) {
      outputString = warnings.join(', ');
    }
    return outputString;
  }

  private isStatusError(poolState: Pool): boolean {
    return [
      PoolStatus.Faulted,
      PoolStatus.Unavailable,
      PoolStatus.Removed,
    ].includes(poolState.status);
  }

  private isStatusWarning(poolState: Pool): boolean {
    return [
      PoolStatus.Locked,
      PoolStatus.Unknown,
      PoolStatus.Offline,
      PoolStatus.Degraded,
    ].includes(poolState.status);
  }

  protected isPoolOffline = computed(() => {
    return this.poolState()?.status === PoolStatus.Offline;
  });

  // TODO: Unclear why this conversion is needed.
  private dashboardDiskToDisk(dashDisk: StorageDashboardDisk): Disk {
    const output: EmptyDiskObject | Disk = {};
    const keys: string[] = Object.keys(dashDisk);
    keys.forEach((key: keyof StorageDashboardDisk) => {
      if (
        key === 'alerts'
        || key === 'tempAggregates'
      ) {
        return;
      }

      output[key as keyof Disk] = dashDisk[key];
    });

    return output as unknown as Disk;
  }
}
