import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatToolbarRow } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  catchError, EMPTY, filter, of, switchMap, tap,
} from 'rxjs';
import { replicationTaskEmptyConfig } from 'app/constants/empty-configs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { JobState } from 'app/enums/job-state.enum';
import { Role } from 'app/enums/role.enum';
import { tapOnce } from 'app/helpers/operators/tap-once.operator';
import { Job } from 'app/interfaces/job.interface';
import { ReplicationTask } from 'app/interfaces/replication-task.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { EmptyComponent } from 'app/modules/empty/empty.component';
import { EmptyService } from 'app/modules/empty/empty.service';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { AsyncDataProvider } from 'app/modules/ix-table/classes/async-data-provider/async-data-provider';
import { IxTableComponent } from 'app/modules/ix-table/components/ix-table/ix-table.component';
import { actionsWithMenuColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-actions-with-menu/ix-cell-actions-with-menu.component';
import {
  relativeDateColumn,
} from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-relative-date/ix-cell-relative-date.component';
import {
  stateButtonColumn,
} from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-state-button/ix-cell-state-button.component';
import { textColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-text/ix-cell-text.component';
import {
  toggleColumn,
} from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-toggle/ix-cell-toggle.component';
import { IxTableBodyComponent } from 'app/modules/ix-table/components/ix-table-body/ix-table-body.component';
import { IxTableHeadComponent } from 'app/modules/ix-table/components/ix-table-head/ix-table-head.component';
import { IxTableEmptyDirective } from 'app/modules/ix-table/directives/ix-table-empty.directive';
import { createTable } from 'app/modules/ix-table/utils';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import {
  ReplicationFormComponent,
} from 'app/pages/data-protection/replication/replication-form/replication-form.component';
import {
  ReplicationRestoreDialog,
} from 'app/pages/data-protection/replication/replication-restore-dialog/replication-restore-dialog.component';
import {
  ReplicationWizardComponent,
} from 'app/pages/data-protection/replication/replication-wizard/replication-wizard.component';
import { DownloadService } from 'app/services/download.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-replication-task-card',
  templateUrl: './replication-task-card.component.html',
  styleUrls: ['./replication-task-card.component.scss'],
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
export class ReplicationTaskCardComponent implements OnInit {
  private slideIn = inject(SlideIn);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorHandlerService);
  private api = inject(ApiService);
  private dialogService = inject(DialogService);
  private snackbar = inject(SnackbarService);
  private matDialog = inject(MatDialog);
  private download = inject(DownloadService);
  protected emptyService = inject(EmptyService);

  dataProvider: AsyncDataProvider<ReplicationTask>;
  jobStates = new Map<number, JobState>();
  replicationTasks: ReplicationTask[] = [];
  protected readonly requiredRoles = [Role.ReplicationTaskWrite, Role.ReplicationTaskWritePull];
  protected readonly emptyConfig = replicationTaskEmptyConfig;

  columns = createTable<ReplicationTask>([
    textColumn({
      title: this.translate.instant('Name'),
      propertyName: 'name',
    }),
    textColumn({
      title: this.translate.instant('Last Snapshot'),
      getValue: (task) => {
        return task.state.last_snapshot
          ? task.state.last_snapshot
          : this.translate.instant('No snapshots sent yet');
      },
    }),
    toggleColumn({
      title: this.translate.instant('Enabled'),
      propertyName: 'enabled',
      onRowToggle: (row: ReplicationTask) => this.onChangeEnabledState(row),
      requiredRoles: this.requiredRoles,
    }),
    stateButtonColumn({
      title: this.translate.instant('State'),
      getValue: (row) => row.state.state,
      getJob: (row) => row.job || null,
      cssClass: 'state-button',
    }),
    relativeDateColumn({
      title: this.translate.instant('Last Run'),
      getValue: (row) => row.state?.datetime?.$date,
    }),
    actionsWithMenuColumn({
      actions: [
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (row) => this.editReplicationTask(row),
        },
        {
          iconName: iconMarker('mdi-play-circle'),
          tooltip: this.translate.instant('Run job'),
          hidden: (row) => of(row.job?.state === JobState.Running),
          onClick: (row) => this.runNow(row),
          requiredRoles: this.requiredRoles,
        },
        {
          iconName: iconMarker('restore'),
          tooltip: this.translate.instant('Restore'),
          onClick: (row) => this.restore(row),
          requiredRoles: this.requiredRoles,
        },
        {
          iconName: iconMarker('mdi-download'),
          tooltip: this.translate.instant('Download encryption keys'),
          hidden: (row) => of(!row.has_encrypted_dataset_keys),
          onClick: (row) => this.downloadKeys(row),
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
    uniqueRowTag: (row) => 'replication-task-' + row.name,
    ariaLabels: (row) => [row.name, this.translate.instant('Replication Task')],
  });

  ngOnInit(): void {
    const replicationTasks$ = this.api.call('replication.query', [[], {
      extra: { check_dataset_encryption_keys: true },
    }]).pipe(
      tap((replicationTasks) => this.replicationTasks = replicationTasks),
      untilDestroyed(this),
    );
    this.dataProvider = new AsyncDataProvider<ReplicationTask>(replicationTasks$);
    this.getReplicationTasks();
  }

  getReplicationTasks(): void {
    this.dataProvider.load();
  }

  protected doDelete(replicationTask: ReplicationTask): void {
    this.dialogService.confirm({
      title: this.translate.instant('Confirmation'),
      message: this.translate.instant('Delete Replication Task <b>"{name}"</b>?', {
        name: replicationTask.name,
      }),
      buttonColor: 'warn',
      buttonText: this.translate.instant('Delete'),
    }).pipe(
      filter(Boolean),
      switchMap(() => this.api.call('replication.delete', [replicationTask.id])),
      untilDestroyed(this),
    ).subscribe({
      next: () => {
        this.getReplicationTasks();
      },
      error: (error: unknown) => {
        this.errorHandler.showErrorModal(error);
      },
    });
  }

  protected addReplicationTask(): void {
    this.slideIn.open(ReplicationWizardComponent, { wide: true }).pipe(
      filter((response) => !!response),
      untilDestroyed(this),
    ).subscribe(() => this.getReplicationTasks());
  }

  private editReplicationTask(row: ReplicationTask): void {
    this.slideIn.open(ReplicationFormComponent, { wide: true, data: row })
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe(() => this.getReplicationTasks());
  }

  protected runNow(row: ReplicationTask): void {
    this.dialogService.confirm({
      title: this.translate.instant('Run Now'),
      message: this.translate.instant('Replicate «{name}» now?', { name: row.name }),
      hideCheckbox: true,
    }).pipe(
      filter(Boolean),
      tap(() => this.updateRowStateAndJob(row, JobState.Running, row.job)),
      switchMap(() => this.api.job('replication.run', [row.id])),
      tapOnce(() => {
        this.snackbar.success(
          this.translate.instant('Replication «{name}» has started.', { name: row.name }),
        );
      }),
      catchError((error: unknown) => {
        this.getReplicationTasks();
        this.errorHandler.showErrorModal(error);
        return EMPTY;
      }),
      untilDestroyed(this),
    ).subscribe((job: Job) => {
      this.updateRowStateAndJob(row, job.state, job);
      if (this.jobStates.get(job.id) !== job.state) {
        this.getReplicationTasks();
      }
      this.jobStates.set(job.id, job.state);
    });
  }

  protected restore(row: ReplicationTask): void {
    const dialog = this.matDialog.open(ReplicationRestoreDialog, {
      data: row.id,
    });
    dialog.afterClosed().pipe(filter(Boolean), untilDestroyed(this)).subscribe(() => this.getReplicationTasks());
  }

  protected downloadKeys(row: ReplicationTask): void {
    this.download.coreDownload({
      method: 'pool.dataset.export_keys_for_replication',
      mimeType: 'application/json',
      arguments: [row.id],
      fileName: `${row.name}_encryption_keys.json`,
    })
      .pipe(
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      ).subscribe();
  }

  private onChangeEnabledState(replicationTask: ReplicationTask): void {
    this.api
      .call('replication.update', [replicationTask.id, { enabled: !replicationTask.enabled }])
      .pipe(untilDestroyed(this))
      .subscribe({
        next: () => {
          this.getReplicationTasks();
        },
        error: (error: unknown) => {
          this.getReplicationTasks();
          this.errorHandler.showErrorModal(error);
        },
      });
  }

  private updateRowStateAndJob(row: ReplicationTask, state: JobState, job: Job | null): void {
    this.replicationTasks = this.replicationTasks.map((task) => {
      if (task.id === row.id) {
        return {
          ...task,
          state: { state },
          job,
        };
      }
      return task;
    });
    this.dataProvider.setRows(this.replicationTasks);
  }
}
