import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { VmState } from 'app/enums/vm.enum';
import { VirtualMachine } from 'app/interfaces/virtual-machine.interface';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { LoaderService } from 'app/modules/loader/loader.service';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { VmEditFormComponent } from 'app/pages/vm/vm-edit-form/vm-edit-form.component';
import { CloneVmDialogComponent } from 'app/pages/vm/vm-list/clone-vm-dialog/clone-vm-dialog.component';
import { DeleteVmDialogComponent } from 'app/pages/vm/vm-list/delete-vm-dialog/delete-vm-dialog.component';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { VmService } from 'app/services/vm.service';

@UntilDestroy()
@Component({
  selector: 'ix-vm-details-row',
  templateUrl: './vm-details-row.component.html',
  styleUrls: ['./vm-details-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    IxIconComponent,
    TranslateModule,
  ],
})
export class VirtualMachineDetailsRowComponent {
  private loader = inject(LoaderService);
  private slideIn = inject(SlideIn);
  private matDialog = inject(MatDialog);
  private router = inject(Router);
  private errorHandler = inject(ErrorHandlerService);
  private vmService = inject(VmService);

  readonly vm = input.required<VirtualMachine>();

  protected readonly requiredReadRoles = [Role.VmRead];
  protected readonly requiredRoles = [Role.VmWrite];

  readonly isRunning = computed(() => this.vm().status.state === VmState.Running);

  readonly showDisplayButton = computed(() => this.isRunning() && this.vm().display_available);

  protected doStart(): void {
    this.vmService.doStart(this.vm());
  }

  protected doStop(): void {
    this.vmService.doStop(this.vm());
  }

  protected doRestart(): void {
    this.vmService
      .doRestart(this.vm())
      .pipe(untilDestroyed(this))
      .subscribe({
        complete: () => this.vmService.checkMemory(),
        error: (error: unknown) => this.errorHandler.showErrorModal(error),
      });
  }

  protected doPowerOff(): void {
    this.vmService.doPowerOff(this.vm());
  }

  protected openDisplay(): void {
    this.vmService.openDisplay(this.vm());
  }

  protected openDevices(): void {
    this.router.navigate(['/vm', String(this.vm().id), 'devices']);
  }

  protected openSerialShell(): void {
    this.router.navigate(['/vm', String(this.vm().id), 'serial']);
  }

  protected doEdit(): void {
    this.slideIn
      .open(VmEditFormComponent, { data: this.vm() })
      .pipe(filter((response) => !!response.response), untilDestroyed(this))
      .subscribe(() => this.vmService.refreshVmList$.next());
  }

  protected doDelete(): void {
    this.matDialog
      .open(DeleteVmDialogComponent, { data: this.vm() })
      .afterClosed()
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe(() => this.vmService.refreshVmList$.next());
  }

  protected doClone(): void {
    this.matDialog
      .open(CloneVmDialogComponent, { data: this.vm() })
      .afterClosed()
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe(() => this.vmService.refreshVmList$.next());
  }

  protected downloadLogs(): void {
    this.vmService
      .downloadLogs(this.vm())
      .pipe(this.loader.withLoader(), untilDestroyed(this))
      .subscribe({
        error: (error: unknown) => this.errorHandler.showErrorModal(error),
      });
  }
}
