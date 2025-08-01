import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import { MatToolbarRow } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, filter, switchMap } from 'rxjs';
import { nfsCardEmptyConfig } from 'app/constants/empty-configs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { ServiceName } from 'app/enums/service-name.enum';
import { LoadingMap, accumulateLoadingState } from 'app/helpers/operators/accumulate-loading-state.helper';
import { NfsShare } from 'app/interfaces/nfs-share.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { EmptyComponent } from 'app/modules/empty/empty.component';
import { EmptyService } from 'app/modules/empty/empty.service';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { AsyncDataProvider } from 'app/modules/ix-table/classes/async-data-provider/async-data-provider';
import { IxTableComponent } from 'app/modules/ix-table/components/ix-table/ix-table.component';
import { actionsWithMenuColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-actions-with-menu/ix-cell-actions-with-menu.component';
import { textColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-text/ix-cell-text.component';
import { toggleColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-toggle/ix-cell-toggle.component';
import { IxTableBodyComponent } from 'app/modules/ix-table/components/ix-table-body/ix-table-body.component';
import { IxTableHeadComponent } from 'app/modules/ix-table/components/ix-table-head/ix-table-head.component';
import { IxTablePagerShowMoreComponent } from 'app/modules/ix-table/components/ix-table-pager-show-more/ix-table-pager-show-more.component';
import { IxTableEmptyDirective } from 'app/modules/ix-table/directives/ix-table-empty.directive';
import { SortDirection } from 'app/modules/ix-table/enums/sort-direction.enum';
import { createTable } from 'app/modules/ix-table/utils';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ServiceExtraActionsComponent } from 'app/pages/sharing/components/shares-dashboard/service-extra-actions/service-extra-actions.component';
import { ServiceStateButtonComponent } from 'app/pages/sharing/components/shares-dashboard/service-state-button/service-state-button.component';
import { NfsFormComponent } from 'app/pages/sharing/nfs/nfs-form/nfs-form.component';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { ServicesState } from 'app/store/services/services.reducer';
import { selectService } from 'app/store/services/services.selectors';

@UntilDestroy()
@Component({
  selector: 'ix-nfs-card',
  templateUrl: './nfs-card.component.html',
  styleUrls: ['./nfs-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatToolbarRow,
    TestDirective,
    IxIconComponent,
    ServiceStateButtonComponent,
    RequiresRolesDirective,
    MatButton,
    ServiceExtraActionsComponent,
    IxTableComponent,
    IxTableEmptyDirective,
    IxTableHeadComponent,
    IxTableBodyComponent,
    IxTablePagerShowMoreComponent,
    TranslateModule,
    AsyncPipe,
    RouterLink,
    EmptyComponent,
  ],
})
export class NfsCardComponent implements OnInit {
  private slideIn = inject(SlideIn);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorHandlerService);
  private api = inject(ApiService);
  private dialogService = inject(DialogService);
  private store$ = inject<Store<ServicesState>>(Store);
  protected emptyService = inject(EmptyService);

  loadingMap$ = new BehaviorSubject<LoadingMap>(new Map());
  requiredRoles = [Role.SharingNfsWrite, Role.SharingWrite];
  service$ = this.store$.select(selectService(ServiceName.Nfs));
  dataProvider: AsyncDataProvider<NfsShare>;
  protected readonly emptyConfig = nfsCardEmptyConfig;

  columns = createTable<NfsShare>([
    textColumn({
      title: this.translate.instant('Path'),
      propertyName: 'path',
    }),
    textColumn({
      title: this.translate.instant('Description'),
      propertyName: 'comment',
    }),
    toggleColumn({
      title: this.translate.instant('Enabled'),
      propertyName: 'enabled',
      onRowToggle: (row: NfsShare) => this.onChangeEnabledState(row),
      requiredRoles: this.requiredRoles,
    }),
    actionsWithMenuColumn({
      cssClass: 'tight-actions',
      actions: [
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (row) => this.openForm(row),
        },
        {
          iconName: iconMarker('mdi-delete'),
          tooltip: this.translate.instant('Delete'),
          onClick: (row) => this.doDelete(row),
          requiredRoles: this.requiredRoles,
        },
      ],
    }),
  ], {
    uniqueRowTag: (row) => 'card-nfs-share-' + row.path + '-' + row.comment,
    ariaLabels: (row) => [row.path, this.translate.instant('NFS Share')],
  });

  ngOnInit(): void {
    const nfsShares$ = this.api.call('sharing.nfs.query').pipe(untilDestroyed(this));
    this.dataProvider = new AsyncDataProvider<NfsShare>(nfsShares$);
    this.setDefaultSort();
    this.dataProvider.load();
  }

  protected openForm(row?: NfsShare): void {
    this.slideIn.open(NfsFormComponent, { data: { existingNfsShare: row } }).pipe(
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe(() => {
      this.dataProvider.load();
    });
  }

  protected doDelete(nfs: NfsShare): void {
    this.dialogService.confirm({
      message: this.translate.instant('Are you sure you want to delete NFS Share <b>"{path}"</b>?', { path: nfs.path }),
      buttonColor: 'warn',
      buttonText: this.translate.instant('Delete'),
    }).pipe(
      filter(Boolean),
      switchMap(() => this.api.call('sharing.nfs.delete', [nfs.id])),
      untilDestroyed(this),
    ).subscribe({
      next: () => {
        this.dataProvider.load();
      },
      error: (error: unknown) => {
        this.errorHandler.showErrorModal(error);
      },
    });
  }

  private onChangeEnabledState(row: NfsShare): void {
    const param = 'enabled';

    this.api.call('sharing.nfs.update', [row.id, { [param]: !row[param] }]).pipe(
      accumulateLoadingState(row.id, this.loadingMap$),
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

  protected setDefaultSort(): void {
    this.dataProvider.setSorting({
      active: 0,
      direction: SortDirection.Asc,
      propertyName: 'path',
    });
  }
}
