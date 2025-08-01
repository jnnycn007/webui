import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatToolbarRow } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  filter, of, take, tap,
} from 'rxjs';
import { smbCardEmptyConfig } from 'app/constants/empty-configs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { EmptyType } from 'app/enums/empty-type.enum';
import { Role } from 'app/enums/role.enum';
import { ServiceName } from 'app/enums/service-name.enum';
import { shared } from 'app/helptext/sharing';
import { SmbSharePurpose, SmbShare } from 'app/interfaces/smb-share.interface';
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
import {
  yesNoColumn,
} from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-yes-no/ix-cell-yes-no.component';
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
import { ServiceStateButtonComponent } from 'app/pages/sharing/components/shares-dashboard/service-state-button/service-state-button.component';
import { SmbAclComponent } from 'app/pages/sharing/smb/smb-acl/smb-acl.component';
import { SmbFormComponent } from 'app/pages/sharing/smb/smb-form/smb-form.component';
import { smbListElements } from 'app/pages/sharing/smb/smb-list/smb-list.elements';
import { isRootShare } from 'app/pages/sharing/utils/smb.utils';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { ServicesState } from 'app/store/services/services.reducer';
import { selectService } from 'app/store/services/services.selectors';

@UntilDestroy()
@Component({
  selector: 'ix-smb-list',
  templateUrl: './smb-list.component.html',
  styleUrls: ['./smb-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    FakeProgressBarComponent,
    MatToolbarRow,
    ServiceStateButtonComponent,
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
export class SmbListComponent implements OnInit {
  private loader = inject(LoaderService);
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private dialog = inject(DialogService);
  private errorHandler = inject(ErrorHandlerService);
  private slideIn = inject(SlideIn);
  private cdr = inject(ChangeDetectorRef);
  protected emptyService = inject(EmptyService);
  private router = inject(Router);
  private store$ = inject<Store<ServicesState>>(Store);

  protected readonly requiredRoles = [Role.SharingSmbWrite, Role.SharingWrite];
  protected readonly searchableElements = smbListElements;
  protected readonly emptyConfig = smbCardEmptyConfig;
  protected readonly EmptyType = EmptyType;

  service$ = this.store$.select(selectService(ServiceName.Cifs));

  filterString = '';
  dataProvider: AsyncDataProvider<SmbShare>;

  smbShares: SmbShare[] = [];
  columns = createTable<SmbShare>([
    textColumn({
      title: this.translate.instant('Name'),
      propertyName: 'name',
    }),
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
      requiredRoles: this.requiredRoles,
      onRowToggle: (row) => this.onChangeEnabledState(row),
    }),
    yesNoColumn({
      title: this.translate.instant('Audit Logging'),
      getValue: (row) => Boolean(row.audit?.enable),
    }),
    actionsWithMenuColumn({
      actions: [
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (smbShare) => {
            this.slideIn.open(SmbFormComponent, { data: { existingSmbShare: smbShare } }).pipe(
              take(1),
              filter((response) => !!response.response),
              untilDestroyed(this),
            ).subscribe(() => this.dataProvider.load());
          },
        },
        {
          iconName: iconMarker('share'),
          tooltip: this.translate.instant('Edit Share ACL'),
          onClick: (row) => {
            if (row.locked) {
              this.lockedPathDialog(row.path);
            } else {
              // A home share has a name (homes) set; row.name works for other shares
              const searchName = (row.purpose === SmbSharePurpose.LegacyShare && row.options?.home)
                ? 'homes'
                : row.name;
              this.loader.open();
              this.api.call('sharing.smb.getacl', [{ share_name: searchName }])
                .pipe(untilDestroyed(this))
                .subscribe((shareAcl) => {
                  this.loader.close();
                  this.slideIn.open(SmbAclComponent, { data: shareAcl.share_name }).pipe(
                    take(1),
                    filter((response) => !!response.response),
                    untilDestroyed(this),
                  ).subscribe(() => {
                    this.dataProvider.load();
                  });
                });
            }
          },
        },
        {
          iconName: iconMarker('security'),
          tooltip: this.translate.instant('Edit Filesystem ACL'),
          disabled: (row) => of(isRootShare(row.path)),
          onClick: (row) => {
            if (row.locked) {
              this.lockedPathDialog(row.path);
            } else {
              this.router.navigate(['/', 'datasets', 'acl', 'edit'], {
                queryParams: {
                  path: row.path,
                },
              });
            }
          },
        },
        {
          iconName: iconMarker('mdi-delete'),
          tooltip: this.translate.instant('Delete'),
          requiredRoles: this.requiredRoles,
          onClick: (row) => {
            this.dialog.confirm({
              title: this.translate.instant('Unshare {name}', { name: row.name }),
              message: this.translate.instant(shared.deleteShareMessage),
              buttonText: this.translate.instant('Unshare'),
              buttonColor: 'warn',
            }).pipe(
              filter(Boolean),
              untilDestroyed(this),
            ).subscribe({
              next: () => {
                this.api.call('sharing.smb.delete', [row.id]).pipe(
                  this.loader.withLoader(),
                  this.errorHandler.withErrorHandler(),
                  untilDestroyed(this),
                ).subscribe(() => {
                  this.dataProvider.load();
                });
              },
            });
          },
        },
      ],
    }),
  ], {
    uniqueRowTag: (row) => 'smb-' + row.name,
    ariaLabels: (row) => [row.name, this.translate.instant('SMB Share')],
  });

  ngOnInit(): void {
    const shares$ = this.api.call('sharing.smb.query').pipe(
      tap((shares) => this.smbShares = shares),
      untilDestroyed(this),
    );
    this.dataProvider = new AsyncDataProvider<SmbShare>(shares$);
    this.dataProvider.load();
    this.setDefaultSort();
    this.dataProvider.emptyType$.pipe(untilDestroyed(this)).subscribe(() => {
      this.onListFiltered(this.filterString);
    });
  }

  private setDefaultSort(): void {
    this.dataProvider.setSorting({
      active: 0,
      direction: SortDirection.Asc,
      propertyName: 'name',
    });
  }

  protected doAdd(): void {
    this.slideIn.open(SmbFormComponent).pipe(
      take(1),
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe({
      next: () => {
        this.dataProvider.load();
      },
    });
  }

  protected onListFiltered(query: string): void {
    this.filterString = query;
    this.dataProvider.setFilter({
      query,
      columnKeys: !this.smbShares.length ? [] : Object.keys(this.smbShares[0]) as (keyof SmbShare)[],
    });
    this.cdr.markForCheck();
  }

  protected columnsChange(columns: typeof this.columns): void {
    this.columns = [...columns];
    this.cdr.detectChanges();
    this.cdr.markForCheck();
  }

  private lockedPathDialog(path: string): void {
    this.dialog.error({
      title: this.translate.instant('Error'),
      message: this.translate.instant('The path <i>{path}</i> is in a locked dataset.', { path }),
    });
  }

  private onChangeEnabledState(row: SmbShare): void {
    this.api.call('sharing.smb.update', [row.id, { enabled: !row.enabled }]).pipe(
      this.loader.withLoader(),
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
