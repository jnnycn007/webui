import {
  Breakpoints,
  BreakpointState,
  BreakpointObserver,
} from '@angular/cdk/layout';
import { CdkTreeNodePadding, FlatTreeControl } from '@angular/cdk/tree';
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, AfterViewInit, OnDestroy, ElementRef, TrackByFunction, HostBinding, computed, viewChild, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconButton } from '@angular/material/button';
import {
  ActivatedRoute, NavigationStart, Router,
  RouterLink, RouterLinkActive,
} from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ResizedEvent } from 'angular-resize-event';
import { uniqBy } from 'lodash-es';
import { Subject, Subscription } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
} from 'rxjs/operators';
import { datasetEmptyConfig } from 'app/constants/empty-configs';
import { DetailsHeightDirective } from 'app/directives/details-height/details-height.directive';
import { EmptyType } from 'app/enums/empty-type.enum';
import { Role } from 'app/enums/role.enum';
import { extractApiErrorDetails } from 'app/helpers/api.helper';
import { WINDOW } from 'app/helpers/window.helper';
import { DatasetDetails } from 'app/interfaces/dataset.interface';
import { EmptyConfig } from 'app/interfaces/empty-config.interface';
import { EmptyComponent } from 'app/modules/empty/empty.component';
import { SearchInput1Component } from 'app/modules/forms/search-input1/search-input1.component';
import { searchDelayConst } from 'app/modules/global-search/constants/delay.const';
import { UiSearchDirectivesService } from 'app/modules/global-search/services/ui-search-directives.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { TreeNodeComponent } from 'app/modules/ix-tree/components/tree-node/tree-node.component';
import {
  TreeVirtualScrollViewComponent,
} from 'app/modules/ix-tree/components/tree-virtual-scroll-view/tree-virtual-scroll-view.component';
import { TreeNodeDefDirective } from 'app/modules/ix-tree/directives/tree-node-def.directive';
import { TreeNodeToggleDirective } from 'app/modules/ix-tree/directives/tree-node-toggle.directive';
import { TreeDataSource } from 'app/modules/ix-tree/tree-datasource';
import { TreeFlattener } from 'app/modules/ix-tree/tree-flattener';
import { LayoutService } from 'app/modules/layout/layout.service';
import { FakeProgressBarComponent } from 'app/modules/loader/components/fake-progress-bar/fake-progress-bar.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { DatasetDetailsPanelComponent } from 'app/pages/datasets/components/dataset-details-panel/dataset-details-panel.component';
import { datasetManagementElements } from 'app/pages/datasets/components/dataset-management/dataset-management.elements';
import { DatasetNodeComponent } from 'app/pages/datasets/components/dataset-node/dataset-node.component';
import { DatasetTreeStore } from 'app/pages/datasets/store/dataset-store.service';
import { datasetNameSortComparer } from 'app/pages/datasets/utils/dataset.utils';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-dataset-management',
  templateUrl: './dataset-management.component.html',
  styleUrls: ['./dataset-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyComponent,
    FakeProgressBarComponent,
    SearchInput1Component,
    DatasetNodeComponent,
    IxIconComponent,
    RouterLink,
    MatIconButton,
    CdkTreeNodePadding,
    TestDirective,
    DetailsHeightDirective,
    DatasetDetailsPanelComponent,
    AsyncPipe,
    TranslateModule,
    TreeVirtualScrollViewComponent,
    TreeNodeComponent,
    TreeNodeDefDirective,
    RouterLinkActive,
    TreeNodeToggleDirective,
  ],
})
export class DatasetsManagementComponent implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private activatedRoute = inject(ActivatedRoute);
  private datasetStore = inject(DatasetTreeStore);
  private router = inject(Router);
  protected translate = inject(TranslateService);
  private errorHandler = inject(ErrorHandlerService);
  private breakpointObserver = inject(BreakpointObserver);
  private searchDirectives = inject(UiSearchDirectivesService);
  private layoutService = inject(LayoutService);
  private window = inject<Window>(WINDOW);

  readonly ixTreeHeader = viewChild<ElementRef<HTMLElement>>('ixTreeHeader');
  readonly ixTree = viewChild<ElementRef<HTMLElement>>('ixTree');

  protected readonly requiredRoles = [Role.DatasetWrite];
  protected readonly searchableElements = datasetManagementElements;

  isLoading$ = this.datasetStore.isLoading$;
  selectedDataset$ = this.datasetStore.selectedDataset$;
  @HostBinding('class.details-overlay') showMobileDetails = false;
  isMobileView = false;
  systemDataset = toSignal(this.api.call('systemdataset.config').pipe(map((config) => config.pool)));
  isLoading = true;
  subscription = new Subscription();
  ixTreeHeaderWidth: number | null = null;
  treeWidthChange$ = new Subject<ResizedEvent>();

  error = toSignal(this.datasetStore.error$);

  emptyConfig = computed<EmptyConfig>(() => {
    const error = this.error();

    const apiError = extractApiErrorDetails(error);
    if (apiError?.reason) {
      return {
        type: EmptyType.Errors,
        large: true,
        title: this.translate.instant('Failed to load datasets'),
        message: this.translate.instant(apiError.reason || apiError?.error?.toString()),
        button: {
          label: this.translate.instant('Retry'),
          action: () => this.datasetStore.loadDatasets(),
        },
      };
    }

    return {
      ...datasetEmptyConfig,
      button: {
        label: this.translate.instant('Create Pool'),
        action: () => this.createPool(),
      },
    };
  });

  private readonly scrollSubject = new Subject<number>();

  // Flat API
  getLevel = (dataset: DatasetDetails): number => (dataset?.name?.split('/')?.length || 0) - 1;
  isExpandable = (dataset: DatasetDetails): boolean => Number(dataset?.children?.length) > 0;
  treeControl = new FlatTreeControl<DatasetDetails, string>(
    this.getLevel,
    this.isExpandable,
    { trackBy: (dataset: DatasetDetails) => dataset.id },
  );

  treeFlattener = new TreeFlattener<DatasetDetails, DatasetDetails, string>(
    (dataset) => dataset,
    this.getLevel,
    this.isExpandable,
    () => [],
  );

  dataSource = new TreeDataSource(this.treeControl, this.treeFlattener);
  trackById: TrackByFunction<DatasetDetails> = (index: number, dataset: DatasetDetails): string => dataset?.id;
  readonly hasChild = (_: number, dataset: DatasetDetails): boolean => Number(dataset?.children?.length) > 0;

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationStart), untilDestroyed(this))
      .subscribe(() => {
        if (this.router.getCurrentNavigation()?.extras?.state?.hideMobileDetails) {
          this.closeMobileDetails();
        }
      });
  }

  ngOnInit(): void {
    this.datasetStore.loadDatasets();
    this.setupTree();
    this.listenForRouteChanges();
    this.listenForLoading();
    this.listenForDatasetScrolling();
    this.listenForTreeResizing();
  }

  ngAfterViewInit(): void {
    this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium])
      .pipe(untilDestroyed(this))
      .subscribe((state: BreakpointState) => {
        if (state.matches) {
          this.isMobileView = true;
        } else {
          this.closeMobileDetails();
          this.isMobileView = false;
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private listenForLoading(): void {
    this.isLoading$.pipe(untilDestroyed(this)).subscribe((isLoading) => {
      this.isLoading = isLoading;
      this.cdr.markForCheck();

      if (!isLoading) {
        setTimeout(() => this.handlePendingGlobalSearchElement(), searchDelayConst * 2);
      }
    });
  }

  protected isSystemDataset(dataset: DatasetDetails): boolean {
    return dataset.name.split('/').length === 1 && this.systemDataset() === dataset.name;
  }

  protected treeHeaderScrolled(): void {
    this.scrollSubject.next(this.ixTreeHeader()?.nativeElement?.scrollLeft || 0);
  }

  protected datasetTreeScrolled(scrollLeft: number): void {
    this.scrollSubject.next(scrollLeft);
  }

  protected datasetTreeWidthChanged(event: ResizedEvent): void {
    this.treeWidthChange$.next(event);
  }

  protected onSearch(query: string): void {
    this.dataSource.filter(query);
  }

  protected closeMobileDetails(): void {
    this.showMobileDetails = false;
  }

  protected createPool(): void {
    this.router.navigate(['/storage', 'create']);
  }

  protected viewDetails(dataset: DatasetDetails): void {
    this.layoutService.navigatePreservingScroll(this.router, ['/datasets', dataset.id]);

    if (this.isMobileView) {
      this.showMobileDetails = true;

      // focus on details container
      setTimeout(() => (this.window.document.getElementsByClassName('mobile-back-button')?.[0] as HTMLElement)?.focus(), 0);
    }
  }

  private setupTree(): void {
    this.datasetStore.datasets$.pipe(untilDestroyed(this)).subscribe({
      next: (datasets) => {
        this.createDataSource(datasets);
        this.expandDatasetBranch();
        this.cdr.markForCheck();
      },
      error: (error: unknown) => this.errorHandler.showErrorModal(error),
    });

    this.datasetStore.selectedBranch$
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe({
        next: (selectedBranch: DatasetDetails[]) => {
          selectedBranch.forEach((datasetFromSelectedBranch) => {
            const expandedDataset = this.treeControl.dataNodes
              .find((dataset) => dataset.id === datasetFromSelectedBranch.id);

            if (expandedDataset) {
              this.treeControl.expand(expandedDataset);
            }
          });
        },
        error: (error: unknown) => this.errorHandler.showErrorModal(error),
      });
  }

  private createDataSource(datasets: DatasetDetails[]): void {
    this.dataSource = new TreeDataSource(this.treeControl, this.treeFlattener, datasets);
    this.dataSource.filterPredicate = (datasetsToFilter, query = '') => {
      const result: DatasetDetails[] = [];

      const datasetsMatched = datasetsToFilter
        .filter((dataset) => dataset.name.toLowerCase().includes(query.toLowerCase()));

      datasetsMatched.forEach((dataset) => {
        const paths = dataset.id.split('/');

        for (let i = 1; i <= paths.length; i++) {
          const matched = datasetsToFilter.find((parent) => parent.id === paths.slice(0, i).join('/'));
          if (matched) {
            result.push(matched);
          }
        }
      });

      return uniqBy(result, 'id');
    };
    this.dataSource.sortComparer = datasetNameSortComparer;
    this.dataSource.data = datasets;
  }

  private expandDatasetBranch(): void {
    const routeDatasetId = this.activatedRoute.snapshot.paramMap.get('datasetId');
    if (routeDatasetId) {
      this.datasetStore.selectDatasetById(routeDatasetId);
    } else {
      const firstNode = this.treeControl.dataNodes[0];
      if (firstNode) {
        this.router.navigate(['/datasets', firstNode.id]);
      }
    }
  }

  private listenForRouteChanges(): void {
    this.activatedRoute.params
      .pipe(
        switchMap((params) => {
          return this.datasetStore.datasets$.pipe(
            map((datasets) => {
              const selectedDataset = datasets.find((dataset) => dataset.id === params.datasetId);
              if (!selectedDataset && datasets.length) {
                this.router.navigate(['/datasets', datasets[0]?.id], { replaceUrl: true });
              }
              return selectedDataset ? params.datasetId as string : datasets[0]?.id;
            }),
          );
        }),
        filter(Boolean),
        untilDestroyed(this),
      )
      .subscribe((datasetId) => {
        this.datasetStore.selectDatasetById(datasetId);
      });
  }

  private listenForDatasetScrolling(): void {
    this.subscription.add(
      this.scrollSubject
        .pipe(debounceTime(5), untilDestroyed(this))
        .subscribe({
          next: (scrollLeft: number) => {
            this.window.dispatchEvent(new Event('resize'));
            const treeHeader = this.ixTreeHeader();
            const tree = this.ixTree();

            if (!treeHeader || !tree) {
              return;
            }

            treeHeader.nativeElement.scrollLeft = scrollLeft;
            tree.nativeElement.scrollLeft = scrollLeft;
          },
        }),
    );
  }

  private listenForTreeResizing(): void {
    this.subscription.add(
      this.treeWidthChange$
        .pipe(distinctUntilChanged(), untilDestroyed(this))
        .subscribe({
          next: (event: ResizedEvent) => {
            this.ixTreeHeaderWidth = Math.round(event.newRect.width);
          },
        }),
    );
  }

  private handlePendingGlobalSearchElement(): void {
    const pendingHighlightElement = this.searchDirectives.pendingUiHighlightElement;

    if (pendingHighlightElement) {
      this.searchDirectives.get(pendingHighlightElement)?.highlight(pendingHighlightElement);
    }
  }
}
