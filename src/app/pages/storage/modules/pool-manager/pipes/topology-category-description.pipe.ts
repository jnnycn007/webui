import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { buildNormalizedFileSize } from 'app/helpers/file-size.utils';
import { PoolManagerTopologyCategory } from 'app/pages/storage/modules/pool-manager/store/pool-manager.store';

@Pipe({
  name: 'ixTopologyCategoryDescription',
})
export class TopologyCategoryDescriptionPipe implements PipeTransform {
  private translate = inject(TranslateService);


  transform(category: PoolManagerTopologyCategory, notLimitedToOneLayout = true, ignoreManualLayout = false): string {
    if (category.vdevs.length === 0) {
      return this.translate.instant('None');
    }

    if (category.hasCustomDiskSelection && !ignoreManualLayout) {
      return `${this.translate.instant('Manual layout')} | ${category.vdevs.length} VDEVs`;
    }

    const layoutTypeData = notLimitedToOneLayout ? `${category.vdevsNumber} × ${category.layout} | ` : '';

    const diskSize = buildNormalizedFileSize(Number(category.diskSize || 0));
    return `${layoutTypeData}${category.width} × ${diskSize} (${category.diskType})`;
  }
}
