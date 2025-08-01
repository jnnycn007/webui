import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  filter, switchMap, tap,
} from 'rxjs/operators';
import { rsyncTaskEmptyConfig } from 'app/constants/empty-configs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { EmptyType } from 'app/enums/empty-type.enum';
import { JobState } from 'app/enums/job-state.enum';
import { Role } from 'app/enums/role.enum';
import { RsyncTask } from 'app/interfaces/rsync-task.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { EmptyComponent } from 'app/modules/empty/empty.component';
import { EmptyService } from 'app/modules/empty/empty.service';
import { SearchInput1Component } from 'app/modules/forms/search-input1/search-input1.component';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { AsyncDataProvider } from 'app/modules/ix-table/classes/async-data-provider/async-data-provider';
import { IxTableComponent } from 'app/modules/ix-table/components/ix-table/ix-table.component';
import { actionsWithMenuColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-actions-with-menu/ix-cell-actions-with-menu.component';
import { relativeDateColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-relative-date/ix-cell-relative-date.component';
import {
  scheduleColumn,
} from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-schedule/ix-cell-schedule.component';
import {
  stateButtonColumn,
} from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-state-button/ix-cell-state-button.component';
import { textColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-text/ix-cell-text.component';
import {
  yesNoColumn,
} from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-yes-no/ix-cell-yes-no.component';
import { IxTableBodyComponent } from 'app/modules/ix-table/components/ix-table-body/ix-table-body.component';
import { IxTableColumnsSelectorComponent } from 'app/modules/ix-table/components/ix-table-columns-selector/ix-table-columns-selector.component';
import { IxTableHeadComponent } from 'app/modules/ix-table/components/ix-table-head/ix-table-head.component';
import { IxTablePagerComponent } from 'app/modules/ix-table/components/ix-table-pager/ix-table-pager.component';
import { IxTableEmptyDirective } from 'app/modules/ix-table/directives/ix-table-empty.directive';
import { createTable } from 'app/modules/ix-table/utils';
import { LoaderService } from 'app/modules/loader/loader.service';
import { PageHeaderComponent } from 'app/modules/page-header/page-title-header/page-header.component';
import { CrontabExplanationPipe } from 'app/modules/scheduler/pipes/crontab-explanation.pipe';
import { scheduleToCrontab } from 'app/modules/scheduler/utils/schedule-to-crontab.utils';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { RsyncTaskFormComponent } from 'app/pages/data-protection/rsync-task/rsync-task-form/rsync-task-form.component';
import { rsyncTaskListElements } from 'app/pages/data-protection/rsync-task/rsync-task-list/rsync-task-list.elements';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { TaskService } from 'app/services/task.service';

@UntilDestroy()
@Component({
  selector: 'ix-rsync-task-list',
  templateUrl: './rsync-task-list.component.html',
  styleUrls: ['./rsync-task-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CrontabExplanationPipe],
  imports: [
    PageHeaderComponent,
    SearchInput1Component,
    IxTableColumnsSelectorComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    UiSearchDirective,
    IxTableComponent,
    IxTableEmptyDirective,
    IxTableHeadComponent,
    IxTableBodyComponent,
    IxTablePagerComponent,
    TranslateModule,
    AsyncPipe,
    EmptyComponent,
  ],
})
export class RsyncTaskListComponent implements OnInit {
  private translate = inject(TranslateService);
  private api = inject(ApiService);
  private slideIn = inject(SlideIn);
  private dialogService = inject(DialogService);
  private errorHandler = inject(ErrorHandlerService);
  private loader = inject(LoaderService);
  private crontabExplanation = inject(CrontabExplanationPipe);
  private taskService = inject(TaskService);
  private snackbar = inject(SnackbarService);
  protected emptyService = inject(EmptyService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);

  protected readonly requiredRoles = [Role.SnapshotTaskWrite];
  protected readonly searchableElements = rsyncTaskListElements;
  protected readonly emptyConfig = rsyncTaskEmptyConfig;
  protected readonly EmptyType = EmptyType;

  dataProvider: AsyncDataProvider<RsyncTask>;
  filterString = '';

  columns = createTable<RsyncTask>([
    textColumn({
      title: this.translate.instant('Path'),
      propertyName: 'path',
    }),
    textColumn({
      title: this.translate.instant('Remote Host'),
      propertyName: 'remotehost',
    }),
    textColumn({
      title: this.translate.instant('Remote SSH Port'),
      propertyName: 'remoteport',
      hidden: true,
    }),
    textColumn({
      title: this.translate.instant('Remote Module Name'),
      propertyName: 'remotemodule',
    }),
    textColumn({
      title: this.translate.instant('Remote Path'),
      propertyName: 'remotepath',
      hidden: true,
    }),
    textColumn({
      title: this.translate.instant('Direction'),
      propertyName: 'direction',
    }),
    scheduleColumn({
      title: this.translate.instant('Schedule'),
      propertyName: 'schedule',
      hidden: true,
    }),
    textColumn({
      title: this.translate.instant('Frequency'),
      propertyName: 'schedule',
      getValue: (task) => this.crontabExplanation.transform(scheduleToCrontab(task.schedule)),
    }),
    relativeDateColumn({
      title: this.translate.instant('Next Run'),
      getValue: (row) => (row.enabled
        ? this.taskService.getTaskNextTime(scheduleToCrontab(row.schedule))
        : this.translate.instant('Disabled')),
    }),
    relativeDateColumn({
      title: this.translate.instant('Last Run'),
      getValue: (row) => row.job?.time_finished?.$date,
      hidden: true,
    }),
    textColumn({
      title: this.translate.instant('Short Description'),
      propertyName: 'desc',
    }),
    textColumn({
      title: this.translate.instant('User'),
      propertyName: 'user',
    }),
    yesNoColumn({
      title: this.translate.instant('Delay Updates'),
      propertyName: 'delayupdates',
      hidden: true,
    }),
    stateButtonColumn({
      title: this.translate.instant('Status'),
      getValue: (row) => {
        if (!row.job) {
          return row.locked ? JobState.Locked : JobState.Pending;
        }

        return row.job.state;
      },
      getJob: (row) => row.job,
      cssClass: 'state-button',
    }),
    yesNoColumn({
      title: this.translate.instant('Enabled'),
      propertyName: 'enabled',
    }),
    actionsWithMenuColumn({
      actions: [
        {
          iconName: iconMarker('mdi-play-circle'),
          tooltip: this.translate.instant('Run job'),
          requiredRoles: this.requiredRoles,
          onClick: (row) => this.runNow(row),
        },
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (row) => this.edit(row),
        },
        {
          iconName: iconMarker('mdi-delete'),
          tooltip: this.translate.instant('Delete'),
          requiredRoles: this.requiredRoles,
          onClick: (row) => this.delete(row),
        },
      ],
    }),
  ], {
    uniqueRowTag: (row) => 'rsync-task-' + row.path + '-' + row.remotehost,
    ariaLabels: (row) => [row.path, row.remotehost, this.translate.instant('Rsync Task')],
  });

  ngOnInit(): void {
    this.filterString = this.route.snapshot.paramMap.get('dataset') || '';

    const request$ = this.api.call('rsynctask.query');
    this.dataProvider = new AsyncDataProvider(request$);
    this.refresh();
    this.dataProvider.emptyType$.pipe(untilDestroyed(this)).subscribe(() => {
      this.onListFiltered(this.filterString);
    });
  }

  protected onListFiltered(query: string): void {
    this.filterString = query;
    this.dataProvider.setFilter({ query, columnKeys: ['path', 'desc'] });
  }

  protected columnsChange(columns: typeof this.columns): void {
    this.columns = [...columns];
    this.cdr.detectChanges();
    this.cdr.markForCheck();
  }

  protected runNow(row: RsyncTask): void {
    this.dialogService.confirm({
      title: this.translate.instant('Run Now'),
      message: this.translate.instant('Run «{name}» Rsync now?', {
        name: `${row.remotehost || row.path} ${row.remotemodule ? '- ' + row.remotemodule : ''}`,
      }),
      hideCheckbox: true,
    })
      .pipe(
        filter(Boolean),
        tap(() => {
          this.snackbar.success(
            this.translate.instant('Rsync task has started.'),
          );
        }),
        switchMap(() => this.api.job('rsynctask.run', [row.id])),
        untilDestroyed(this),
      )
      .subscribe(() => this.refresh());
  }

  protected add(): void {
    this.slideIn.open(RsyncTaskFormComponent, { wide: true })
      .pipe(filter((response) => !!response.response), untilDestroyed(this))
      .subscribe(() => this.refresh());
  }

  protected edit(row: RsyncTask): void {
    this.slideIn.open(RsyncTaskFormComponent, { wide: true, data: row })
      .pipe(filter((response) => !!response.response), untilDestroyed(this))
      .subscribe(() => this.refresh());
  }

  protected delete(row: RsyncTask): void {
    this.dialogService.confirm({
      title: this.translate.instant('Delete Task'),
      message: this.translate.instant('Are you sure you want to delete this task?'),
      buttonText: this.translate.instant('Delete'),
      buttonColor: 'warn',
    })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          return this.api.call('rsynctask.delete', [row.id]).pipe(
            this.loader.withLoader(),
            this.errorHandler.withErrorHandler(),
          );
        }),
        untilDestroyed(this),
      )
      .subscribe(() => this.refresh());
  }

  protected refresh(): void {
    this.dataProvider.load();
  }
}
