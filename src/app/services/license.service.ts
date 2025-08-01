import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest, shareReplay } from 'rxjs';
import { map } from 'rxjs/operators';
import { LicenseFeature } from 'app/enums/license-feature.enum';
import { ApiService } from 'app/modules/websocket/api.service';
import { AppState } from 'app/store';
import { selectIsHaLicensed } from 'app/store/ha-info/ha-info.selectors';
import {
  selectHasEnclosureSupport,
  selectIsEnterprise,
  selectLicenseFeatures,
  selectSystemInfo,
  waitForSystemInfo,
} from 'app/store/system-info/system-info.selectors';

@Injectable({
  providedIn: 'root',
})
export class LicenseService {
  private store$ = inject<Store<AppState>>(Store);
  private api = inject(ApiService);

  hasFailover$ = this.store$.select(selectIsHaLicensed);
  hasEnclosure$ = this.store$.select(selectHasEnclosureSupport);
  hasFibreChannel$ = combineLatest([
    this.store$.pipe(
      waitForSystemInfo,
      map((systemInfo) => systemInfo.license?.features?.includes(LicenseFeature.FibreChannel)),
    ),
    this.api.call('fc.capable'),
  ]).pipe(
    map(([hasFibreChannel, isFcCapable]) => hasFibreChannel && isFcCapable),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  hasVms$ = combineLatest([
    this.store$.select(selectSystemInfo),
    this.store$.select(selectIsEnterprise),
  ]).pipe(
    map(([systemInfo, isEnterprise]) => {
      if (!isEnterprise) {
        return true;
      }

      return Boolean(systemInfo?.license?.features?.includes(LicenseFeature.Vm));
    }),
  );

  hasApps$ = combineLatest([
    this.store$.select(selectSystemInfo),
    this.store$.select(selectIsEnterprise),
  ]).pipe(
    map(([systemInfo, isEnterprise]) => {
      if (!isEnterprise) {
        return true;
      }

      return Boolean(systemInfo?.license?.features?.includes(LicenseFeature.Jails));
    }),
  );

  readonly hasKmip$ = this.store$.select(selectIsEnterprise);

  readonly shouldShowContainers$ = combineLatest([
    this.store$.select(selectIsEnterprise),
    this.store$.select(selectLicenseFeatures),
  ]).pipe(map((
    [isEnterprise, licenseFeatures]: [boolean, LicenseFeature[]],
  ) => !isEnterprise || licenseFeatures.includes(LicenseFeature.Jails)));
}
