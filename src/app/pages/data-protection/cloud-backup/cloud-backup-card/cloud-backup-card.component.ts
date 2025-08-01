import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, signal, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import { MatToolbarRow } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  filter, of, switchMap, tap,
} from 'rxjs';
import { cloudBackupTaskEmptyConfig } from 'app/constants/empty-configs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { JobState } from 'app/enums/job-state.enum';
import { Role } from 'app/enums/role.enum';
import { tapOnce } from 'app/helpers/operators/tap-once.operator';
import { WINDOW } from 'app/helpers/window.helper';
import { CloudBackup, CloudBackupUpdate } from 'app/interfaces/cloud-backup.interface';
import { Job } from 'app/interfaces/job.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { EmptyComponent } from 'app/modules/empty/empty.component';
import { EmptyService } from 'app/modules/empty/empty.service';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { AsyncDataProvider } from 'app/modules/ix-table/classes/async-data-provider/async-data-provider';
import { IxTableComponent } from 'app/modules/ix-table/components/ix-table/ix-table.component';
import { actionsWithMenuColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-actions-with-menu/ix-cell-actions-with-menu.component';
import { relativeDateColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-relative-date/ix-cell-relative-date.component';
import { stateButtonColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-state-button/ix-cell-state-button.component';
import { textColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-text/ix-cell-text.component';
import {
  toggleColumn,
} from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-toggle/ix-cell-toggle.component';
import { yesNoColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-yes-no/ix-cell-yes-no.component';
import { IxTableBodyComponent } from 'app/modules/ix-table/components/ix-table-body/ix-table-body.component';
import { IxTableHeadComponent } from 'app/modules/ix-table/components/ix-table-head/ix-table-head.component';
import { IxTableEmptyDirective } from 'app/modules/ix-table/directives/ix-table-empty.directive';
import { SortDirection } from 'app/modules/ix-table/enums/sort-direction.enum';
import { createTable } from 'app/modules/ix-table/utils';
import { LoaderService } from 'app/modules/loader/loader.service';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { CloudBackupFormComponent } from 'app/pages/data-protection/cloud-backup/cloud-backup-form/cloud-backup-form.component';
import { replicationListElements } from 'app/pages/data-protection/replication/replication-list/replication-list.elements';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-cloud-backup-card',
  templateUrl: './cloud-backup-card.component.html',
  styleUrl: './cloud-backup-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatToolbarRow,
    TestDirective,
    RouterLink,
    IxIconComponent,
    RequiresRolesDirective,
    MatButton,
    IxTableComponent,
    IxTableEmptyDirective,
    IxTableHeadComponent,
    IxTableBodyComponent,
    TranslateModule,
    AsyncPipe,
    EmptyComponent,
  ],
})
export class CloudBackupCardComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private slideIn = inject(SlideIn);
  private dialogService = inject(DialogService);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);
  private loader = inject(LoaderService);
  private router = inject(Router);
  protected emptyService = inject(EmptyService);
  private window = inject<Window>(WINDOW);

  cloudBackups: CloudBackup[] = [];
  dataProvider: AsyncDataProvider<CloudBackup>;
  protected readonly requiredRoles = [Role.CloudBackupWrite];
  protected readonly searchableElements = replicationListElements;
  protected readonly emptyConfig = cloudBackupTaskEmptyConfig;
  updatedCount = signal(0);

  columns = createTable<CloudBackup>([
    textColumn({
      title: this.translate.instant('Name'),
      propertyName: 'description',
    }),
    toggleColumn({
      title: this.translate.instant('Enabled'),
      propertyName: 'enabled',
      onRowToggle: (row) => this.onChangeEnabledState(row),
      requiredRoles: this.requiredRoles,
    }),
    yesNoColumn({
      title: this.translate.instant('Snapshot'),
      propertyName: 'snapshot',
    }),
    stateButtonColumn({
      title: this.translate.instant('State'),
      getValue: (row) => row?.job?.state,
      getJob: (row) => row.job,
      cssClass: 'state-button',
    }),
    relativeDateColumn({
      title: this.translate.instant('Last Run'),
      getValue: (row) => row.job?.time_finished?.$date,
    }),
    actionsWithMenuColumn({
      actions: [
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (row) => this.openForm(row),
        },
        {
          iconName: iconMarker('mdi-play-circle'),
          tooltip: this.translate.instant('Run job'),
          hidden: (row) => of(row.job?.state === JobState.Running),
          onClick: (row) => this.runNow(row),
          requiredRoles: this.requiredRoles,
        },
        {
          iconName: iconMarker('visibility'),
          tooltip: this.translate.instant('View Details'),
          onClick: (row) => this.router.navigate(['/data-protection', 'cloud-backup'], { fragment: row.id.toString() }),
          requiredRoles: this.requiredRoles,
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
    uniqueRowTag: (row) => 'cloud-backup-' + row.description,
    ariaLabels: (row) => [row.description, this.translate.instant('Cloud Backup')],
  });

  ngOnInit(): void {
    const cloudBackups$ = this.api.call('cloud_backup.query').pipe(
      tap((cloudBackups) => this.cloudBackups = cloudBackups),
    );
    this.dataProvider = new AsyncDataProvider<CloudBackup>(cloudBackups$);
    this.getCloudBackups();
  }

  setDefaultSort(): void {
    this.dataProvider.setSorting({
      active: 1,
      direction: SortDirection.Asc,
      propertyName: 'description',
    });
  }

  private getCloudBackups(): void {
    this.dataProvider.load();
  }

  protected runNow(row: CloudBackup): void {
    this.dialogService.confirm({
      title: this.translate.instant('Run Now'),
      message: this.translate.instant('Run «{name}» Cloud Backup now?', { name: row.description }),
      hideCheckbox: true,
    }).pipe(
      filter(Boolean),
      tap(() => this.updateRowJob(row, { ...row.job, state: JobState.Running })),
      tapOnce(() => {
        this.snackbar.success(this.translate.instant('Cloud Backup «{name}» has started.', { name: row.description }));
      }),
      switchMap(() => this.api.job('cloud_backup.sync', [row.id])),
      untilDestroyed(this),
    ).subscribe({
      next: (job: Job) => {
        this.updateRowJob(row, job);
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.errorHandler.showErrorModal(error);
        this.getCloudBackups();
      },
    });
  }

  protected openForm(row?: CloudBackup): void {
    this.slideIn.open(CloudBackupFormComponent, { data: row, wide: true })
      .pipe(
        filter((response) => !!response.response),
        untilDestroyed(this),
      ).subscribe({
        next: () => {
          this.getCloudBackups();
        },
      });
  }

  protected doDelete(row: CloudBackup): void {
    this.dialogService.confirm({
      title: this.translate.instant('Confirmation'),
      message: this.translate.instant('Delete Cloud Backup <b>"{name}"</b>?', {
        name: row.description,
      }),
      buttonColor: 'warn',
      buttonText: this.translate.instant('Delete'),
    }).pipe(
      filter(Boolean),
      switchMap(() => this.api.call('cloud_backup.delete', [row.id]).pipe(this.loader.withLoader())),
      untilDestroyed(this),
    ).subscribe({
      next: () => {
        this.getCloudBackups();
      },
      error: (error: unknown) => {
        this.errorHandler.showErrorModal(error);
      },
    });
  }

  private onChangeEnabledState(cloudBackup: CloudBackup): void {
    this.updatedCount.update((count) => count + 1);
    this.api
      .call('cloud_backup.update', [cloudBackup.id, { enabled: !cloudBackup.enabled } as CloudBackupUpdate])
      .pipe(untilDestroyed(this))
      .subscribe({
        next: () => {
          this.updatedCount.update((count) => count - 1);
          if (!this.updatedCount()) {
            this.getCloudBackups();
          }
        },
        error: (error: unknown) => {
          this.updatedCount.update((count) => count - 1);
          if (!this.updatedCount()) {
            this.getCloudBackups();
          }
          this.errorHandler.showErrorModal(error);
        },
      });
  }

  private updateRowJob(row: CloudBackup, job: Job): void {
    this.cloudBackups = this.cloudBackups.map((task) => {
      if (task.id === row.id) {
        return {
          ...task,
          job,
        };
      }
      return task;
    });
    this.dataProvider.setRows(this.cloudBackups);
  }
}
