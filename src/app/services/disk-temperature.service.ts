import { Injectable, inject } from '@angular/core';
import {
  filter, map, Observable, repeat, switchMap, takeUntil,
} from 'rxjs';
import { CollectionChangeType } from 'app/enums/api.enum';
import { EnclosureElementType } from 'app/enums/enclosure-slot-status.enum';
import { DiskTemperatures } from 'app/interfaces/disk.interface';
import { ApiService } from 'app/modules/websocket/api.service';

export interface Temperature {
  keys: string[];
  values: DiskTemperatures;
  unit: string;
  symbolText: string;
}

@Injectable({
  providedIn: 'root',
})
export class DiskTemperatureService {
  protected api = inject(ApiService);

  private disksChanged$ = this.api.subscribe('disk.query').pipe(
    filter((event) => [
      CollectionChangeType.Added,
      CollectionChangeType.Changed,
      CollectionChangeType.Removed,
    ].includes(event.msg)),
  );

  getTemperature(): Observable<DiskTemperatures> {
    return this.api
      .call('webui.enclosure.dashboard')
      .pipe(
        repeat({ delay: () => this.disksChanged$ }),
        map((enclosures) => {
          return enclosures.map((enclosure) => {
            return Object.values(enclosure.elements[EnclosureElementType.ArrayDeviceSlot])
              .map((element) => element.dev)
              .filter((dev) => !!dev) as string[];
          }).flat();
        }),
        switchMap((disks) => {
          return this.api.call('disk.temperatures', [disks]).pipe(
            repeat({ delay: 10000 }),
            takeUntil(this.disksChanged$),
          );
        }),
      );
  }
}
