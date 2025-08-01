import { Component, ChangeDetectionStrategy, input, computed, output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  filter, switchMap,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { VirtualizationStatus } from 'app/enums/virtualization.enum';
import {
  VirtualizationInstance,
  VirtualizationStopParams,
  VirtualizationInstanceMetrics,
} from 'app/interfaces/virtualization.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { YesNoPipe } from 'app/modules/pipes/yes-no/yes-no.pipe';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { InstanceStatusCellComponent } from 'app/pages/instances/components/all-instances/instance-list/instance-row/instance-status-cell/instance-status-cell.component';
import {
  StopOptionsDialog, StopOptionsOperation,
} from 'app/pages/instances/components/all-instances/instance-list/stop-options-dialog/stop-options-dialog.component';
import { VirtualizationInstancesStore } from 'app/pages/instances/stores/virtualization-instances.store';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-instance-row',
  templateUrl: './instance-row.component.html',
  styleUrls: ['./instance-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxIconComponent,
    TestDirective,
    TranslateModule,
    MatTooltipModule,
    MatButtonModule,
    MatCheckboxModule,
    RequiresRolesDirective,
    InstanceStatusCellComponent,
    YesNoPipe,
  ],
})
export class InstanceRowComponent {
  private dialog = inject(DialogService);
  private translate = inject(TranslateService);
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private matDialog = inject(MatDialog);
  private snackbar = inject(SnackbarService);
  private instancesStore = inject(VirtualizationInstancesStore);

  protected readonly requiredRoles = [Role.VirtInstanceWrite];
  readonly instance = input.required<VirtualizationInstance>();
  readonly metrics = input<VirtualizationInstanceMetrics | undefined>();
  readonly selected = input<boolean>(false);
  protected readonly isStopped = computed(() => this.instance()?.status === VirtualizationStatus.Stopped);

  readonly hasMetrics = computed(() => {
    const metrics = this.metrics();

    return this.instance()?.status === VirtualizationStatus.Running
      && metrics
      && Object.keys(metrics).length > 0;
  });

  readonly selectionChange = output();

  start(): void {
    const instanceId = this.instance().id;

    this.dialog.jobDialog(
      this.api.job('virt.instance.start', [instanceId]),
      { title: this.translate.instant('Starting...') },
    )
      .afterClosed()
      .pipe(this.errorHandler.withErrorHandler(), untilDestroyed(this))
      .subscribe(() => {
        this.snackbar.success(this.translate.instant('Container started'));
        this.instancesStore.selectInstance(this.instance().id);
      });
  }

  stop(): void {
    const instanceId = this.instance().id;

    this.matDialog
      .open(StopOptionsDialog, { data: StopOptionsOperation.Stop })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap((options: VirtualizationStopParams) => {
          return this.dialog.jobDialog(
            this.api.job('virt.instance.stop', [instanceId, options]),
            { title: this.translate.instant('Stopping...') },
          )
            .afterClosed()
            .pipe(this.errorHandler.withErrorHandler());
        }),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.snackbar.success(this.translate.instant('Container stopped'));
        this.instancesStore.selectInstance(this.instance().id);
      });
  }

  restart(): void {
    const instanceId = this.instance().id;

    this.matDialog
      .open(StopOptionsDialog, { data: StopOptionsOperation.Restart })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap((options: VirtualizationStopParams) => {
          return this.dialog.jobDialog(
            this.api.job('virt.instance.restart', [instanceId, options]),
            { title: this.translate.instant('Restarting...') },
          )
            .afterClosed()
            .pipe(this.errorHandler.withErrorHandler());
        }),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.snackbar.success(this.translate.instant('Container restarted'));
        this.instancesStore.selectInstance(this.instance().id);
      });
  }
}
