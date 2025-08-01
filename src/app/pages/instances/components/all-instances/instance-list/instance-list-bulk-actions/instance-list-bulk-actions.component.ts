import { Component, ChangeDetectionStrategy, computed, input, output, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  filter,
  tap,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { VirtualizationStatus } from 'app/enums/virtualization.enum';
import { VirtualizationInstance, VirtualizationStopParams } from 'app/interfaces/virtualization.interface';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { StopOptionsDialog, StopOptionsOperation } from 'app/pages/instances/components/all-instances/instance-list/stop-options-dialog/stop-options-dialog.component';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-instance-list-bulk-actions',
  templateUrl: './instance-list-bulk-actions.component.html',
  styleUrls: ['./instance-list-bulk-actions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    IxIconComponent,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    TranslateModule,
    RequiresRolesDirective,
    TestDirective,
  ],
})

export class InstanceListBulkActionsComponent {
  private translate = inject(TranslateService);
  private snackbar = inject(SnackbarService);
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private matDialog = inject(MatDialog);

  readonly checkedInstances = input.required<VirtualizationInstance[]>();
  readonly resetBulkSelection = output();

  protected readonly requiredRoles = [Role.VirtInstanceWrite];

  readonly bulkActionStartedMessage = this.translate.instant('Requested action performed for selected Containers');

  protected readonly isBulkStartDisabled = computed(() => {
    return this.checkedInstances().every(
      (instance) => [VirtualizationStatus.Running].includes(instance.status),
    );
  });

  protected readonly isBulkStopDisabled = computed(() => {
    return this.checkedInstances().every(
      (instance) => [VirtualizationStatus.Stopped].includes(instance.status),
    );
  });

  protected readonly activeCheckedInstances = computed(() => {
    return this.checkedInstances().filter(
      (instance) => [VirtualizationStatus.Running].includes(instance.status),
    );
  });

  protected readonly stoppedCheckedInstances = computed(() => {
    return this.checkedInstances().filter(
      (instance) => [VirtualizationStatus.Stopped].includes(instance.status),
    );
  });

  onBulkStart(): void {
    this.stoppedCheckedInstances().forEach((instance) => this.start(instance.id));
    this.resetBulkSelection.emit();
    this.snackbar.success(this.translate.instant(this.bulkActionStartedMessage));
  }

  onBulkStop(): void {
    this.matDialog
      .open(StopOptionsDialog, { data: StopOptionsOperation.Stop })
      .afterClosed()
      .pipe(
        filter(Boolean),
        tap((options: VirtualizationStopParams) => {
          this.activeCheckedInstances().forEach((instance) => this.stop(instance.id, options));
          this.snackbar.success(this.translate.instant(this.bulkActionStartedMessage));
          this.resetBulkSelection.emit();
        }),
        untilDestroyed(this),
      ).subscribe();
  }

  onBulkRestart(): void {
    this.matDialog
      .open(StopOptionsDialog, { data: StopOptionsOperation.Restart })
      .afterClosed()
      .pipe(
        filter(Boolean),
        tap((options: VirtualizationStopParams) => {
          this.activeCheckedInstances().forEach((instance) => this.restart(instance.id, options));
          this.snackbar.success(this.translate.instant(this.bulkActionStartedMessage));
          this.resetBulkSelection.emit();
        }),
        untilDestroyed(this),
      ).subscribe();
  }

  private start(instanceId: string): void {
    this.api.job('virt.instance.start', [instanceId])
      .pipe(this.errorHandler.withErrorHandler(), untilDestroyed(this))
      .subscribe();
  }

  private stop(instanceId: string, options: VirtualizationStopParams): void {
    this.api.job('virt.instance.stop', [instanceId, options])
      .pipe(this.errorHandler.withErrorHandler(), untilDestroyed(this))
      .subscribe();
  }

  private restart(instanceId: string, options: VirtualizationStopParams): void {
    this.api.job('virt.instance.restart', [instanceId, options])
      .pipe(this.errorHandler.withErrorHandler(), untilDestroyed(this))
      .subscribe();
  }
}
