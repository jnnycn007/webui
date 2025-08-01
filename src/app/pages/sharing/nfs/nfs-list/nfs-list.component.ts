import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatToolbarRow } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { filter, tap } from 'rxjs';
import { nfsCardEmptyConfig } from 'app/constants/empty-configs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { EmptyType } from 'app/enums/empty-type.enum';
import { Role } from 'app/enums/role.enum';
import { shared } from 'app/helptext/sharing';
import { NfsShare } from 'app/interfaces/nfs-share.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { EmptyComponent } from 'app/modules/empty/empty.component';
import { EmptyService } from 'app/modules/empty/empty.service';
import { SearchInput1Component } from 'app/modules/forms/search-input1/search-input1.component';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { AsyncDataProvider } from 'app/modules/ix-table/classes/async-data-provider/async-data-provider';
import { IxTableComponent } from 'app/modules/ix-table/components/ix-table/ix-table.component';
import { actionsWithMenuColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-actions-with-menu/ix-cell-actions-with-menu.component';
import { textColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-text/ix-cell-text.component';
import { toggleColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-toggle/ix-cell-toggle.component';
import { yesNoColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-yes-no/ix-cell-yes-no.component';
import { IxTableBodyComponent } from 'app/modules/ix-table/components/ix-table-body/ix-table-body.component';
import { IxTableColumnsSelectorComponent } from 'app/modules/ix-table/components/ix-table-columns-selector/ix-table-columns-selector.component';
import { IxTableHeadComponent } from 'app/modules/ix-table/components/ix-table-head/ix-table-head.component';
import { IxTablePagerComponent } from 'app/modules/ix-table/components/ix-table-pager/ix-table-pager.component';
import { IxTableEmptyDirective } from 'app/modules/ix-table/directives/ix-table-empty.directive';
import { SortDirection } from 'app/modules/ix-table/enums/sort-direction.enum';
import { createTable } from 'app/modules/ix-table/utils';
import { FakeProgressBarComponent } from 'app/modules/loader/components/fake-progress-bar/fake-progress-bar.component';
import { LoaderService } from 'app/modules/loader/loader.service';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { NfsFormComponent } from 'app/pages/sharing/nfs/nfs-form/nfs-form.component';
import { nfsListElements } from 'app/pages/sharing/nfs/nfs-list/nfs-list.elements';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { AppState } from 'app/store';
import { selectIsEnterprise } from 'app/store/system-info/system-info.selectors';

@UntilDestroy()
@Component({
  selector: 'ix-nfs-list',
  templateUrl: './nfs-list.component.html',
  styleUrls: ['./nfs-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    FakeProgressBarComponent,
    MatToolbarRow,
    SearchInput1Component,
    MatAnchor,
    TestDirective,
    IxTableColumnsSelectorComponent,
    RequiresRolesDirective,
    MatButton,
    UiSearchDirective,
    MatCardContent,
    IxTableComponent,
    IxTableEmptyDirective,
    IxTableHeadComponent,
    IxTableBodyComponent,
    IxTablePagerComponent,
    TranslateModule,
    AsyncPipe,
    RouterLink,
    EmptyComponent,
  ],
})
export class NfsListComponent implements OnInit {
  private loader = inject(LoaderService);
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private dialog = inject(DialogService);
  private errorHandler = inject(ErrorHandlerService);
  private slideIn = inject(SlideIn);
  private cdr = inject(ChangeDetectorRef);
  private store$ = inject<Store<AppState>>(Store);
  protected emptyService = inject(EmptyService);

  requiredRoles = [Role.SharingNfsWrite, Role.SharingWrite];
  protected readonly searchableElements = nfsListElements;
  protected readonly emptyConfig = nfsCardEmptyConfig;
  protected readonly EmptyType = EmptyType;

  filterString = '';
  dataProvider: AsyncDataProvider<NfsShare>;
  readonly isEnterprise = toSignal(this.store$.select(selectIsEnterprise));

  nfsShares: NfsShare[] = [];
  columns = createTable<NfsShare>([
    textColumn({
      title: this.translate.instant('Path'),
      propertyName: 'path',
    }),
    textColumn({
      title: this.translate.instant('Description'),
      propertyName: 'comment',
    }),
    textColumn({
      title: this.translate.instant('Networks'),
      propertyName: 'networks',
      getValue: (row) => {
        return row.networks.reduce((networkList, network, index) => {
          return index > 0 ? networkList + ', ' + network : network;
        }, '');
      },
    }),
    textColumn({
      title: this.translate.instant('Hosts'),
      propertyName: 'hosts',
      getValue: (row) => {
        return row.hosts.reduce((hostsList, host, index) => {
          return index > 0 ? hostsList + ', ' + host : host;
        }, '');
      },
    }),
    toggleColumn({
      title: this.translate.instant('Enabled'),
      propertyName: 'enabled',
      onRowToggle: (row: NfsShare) => this.onChangeEnabledState(row),
      requiredRoles: this.requiredRoles,
    }),
    yesNoColumn({
      title: this.translate.instant('Expose Snapshots'),
      propertyName: 'expose_snapshots',
      hidden: !this.isEnterprise(),
    }),
    actionsWithMenuColumn({
      actions: [
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (nfsShare) => {
            this.slideIn.open(NfsFormComponent, { data: { existingNfsShare: nfsShare } }).pipe(
              filter((response) => !!response.response),
              untilDestroyed(this),
            ).subscribe(() => this.refresh());
          },
        },
        {
          iconName: iconMarker('mdi-delete'),
          tooltip: this.translate.instant('Delete'),
          onClick: (row) => {
            this.dialog.confirm({
              title: this.translate.instant('Delete {name}', { name: row.path }),
              message: this.translate.instant(shared.deleteShareMessage),
              buttonText: this.translate.instant('Delete'),
              buttonColor: 'warn',
            }).pipe(
              filter(Boolean),
              untilDestroyed(this),
            ).subscribe({
              next: () => {
                this.api.call('sharing.nfs.delete', [row.id]).pipe(
                  this.loader.withLoader(),
                  untilDestroyed(this),
                ).subscribe({
                  next: () => this.refresh(),
                });
              },
            });
          },
          requiredRoles: this.requiredRoles,
        },
      ],
    }),
  ], {
    uniqueRowTag: (row) => 'nfs-share-' + row.path + '-' + row.comment,
    ariaLabels: (row) => [row.path, this.translate.instant('NFS Share')],
  });

  ngOnInit(): void {
    const shares$ = this.api.call('sharing.nfs.query').pipe(
      tap((shares) => this.nfsShares = shares),
      untilDestroyed(this),
    );
    this.dataProvider = new AsyncDataProvider<NfsShare>(shares$);
    this.setDefaultSort();
    this.refresh();
    this.dataProvider.emptyType$.pipe(untilDestroyed(this)).subscribe(() => {
      this.onListFiltered(this.filterString);
    });
  }

  private setDefaultSort(): void {
    this.dataProvider.setSorting({
      active: 0,
      direction: SortDirection.Asc,
      propertyName: 'path',
    });
  }

  protected doAdd(): void {
    this.slideIn.open(NfsFormComponent).pipe(
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe({
      next: () => {
        this.refresh();
      },
    });
  }

  protected onListFiltered(query: string): void {
    this.filterString = query;
    this.dataProvider.setFilter({
      query,
      columnKeys: !this.nfsShares.length ? [] : Object.keys(this.nfsShares[0]) as (keyof NfsShare)[],
    });
    this.cdr.markForCheck();
  }

  protected columnsChange(columns: typeof this.columns): void {
    this.columns = [...columns];
    this.cdr.detectChanges();
    this.cdr.markForCheck();
  }

  private refresh(): void {
    this.dataProvider.load();
  }

  private onChangeEnabledState(row: NfsShare): void {
    this.api.call('sharing.nfs.update', [row.id, { enabled: !row.enabled }]).pipe(
      untilDestroyed(this),
    ).subscribe({
      next: () => {
        this.dataProvider.load();
      },
      error: (error: unknown) => {
        this.dataProvider.load();
        this.errorHandler.showErrorModal(error);
      },
    });
  }
}
