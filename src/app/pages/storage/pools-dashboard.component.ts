import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, OnInit, inject } from '@angular/core';
import { MatButton, MatAnchor } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { storageEmptyConfig } from 'app/constants/empty-configs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { Role } from 'app/enums/role.enum';
import { Dataset } from 'app/interfaces/dataset.interface';
import { StorageDashboardDisk } from 'app/interfaces/disk.interface';
import { Pool } from 'app/interfaces/pool.interface';
import { EmptyComponent } from 'app/modules/empty/empty.component';
import { PageHeaderComponent } from 'app/modules/page-header/page-title-header/page-header.component';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { DashboardPoolComponent } from 'app/pages/storage/components/dashboard-pool/dashboard-pool.component';
import { ImportPoolComponent } from 'app/pages/storage/components/import-pool/import-pool.component';
import { UnusedResourcesComponent } from 'app/pages/storage/components/unused-resources/unused-resources.component';
import { storageElements } from 'app/pages/storage/pools-dashboard.elements';
import { PoolsDashboardStore } from 'app/pages/storage/stores/pools-dashboard-store.service';

@UntilDestroy()
@Component({
  selector: 'ix-pools-dashboard',
  templateUrl: './pools-dashboard.component.html',
  styleUrls: ['./pools-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    UiSearchDirective,
    MatAnchor,
    RouterLink,
    DashboardPoolComponent,
    EmptyComponent,
    UnusedResourcesComponent,
    TranslateModule,
  ],
  providers: [
    PoolsDashboardStore,
  ],
})
export class PoolsDashboardComponent implements OnInit {
  protected router = inject(Router);
  private slideIn = inject(SlideIn);
  private cdr = inject(ChangeDetectorRef);
  private store = inject(PoolsDashboardStore);
  protected translate = inject(TranslateService);

  protected readonly requiredRoles = [Role.PoolWrite];
  readonly searchableElements = storageElements;

  rootDatasets: Record<string, Dataset> = {};

  protected readonly emptyConfig = {
    ...storageEmptyConfig,
    button: {
      label: this.translate.instant('Create Pool'),
      action: () => this.router.navigate(['/storage', 'create']),
    },
  };

  readonly pools = this.store.pools;
  readonly arePoolsLoading = this.store.arePoolsLoading;
  readonly isLoadingPoolDetails = this.store.isLoadingPoolDetails;

  readonly hasNoPools = computed(() => this.pools().length === 0);

  ngOnInit(): void {
    this.store.rootDatasets$
      .pipe(untilDestroyed(this))
      .subscribe((rootDatasets) => {
        this.rootDatasets = rootDatasets;
        this.cdr.markForCheck();
      });

    this.store.loadDashboard();
  }

  protected getDisksByPool(pool: Pool): StorageDashboardDisk[] {
    return this.store.disksByPool()[pool.name] || [];
  }

  protected onImportPool(): void {
    this.slideIn.open(ImportPoolComponent).pipe(
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe(() => this.store.loadDashboard());
  }
}
