import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogClose,
} from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { helptextDisks } from 'app/helptext/storage/disks/disks';
import { Disk } from 'app/interfaces/disk.interface';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { LoaderService } from 'app/modules/loader/loader.service';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-manage-disk-sed-dialog',
  templateUrl: './manage-disk-sed-dialog.component.html',
  styleUrls: ['./manage-disk-sed-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    ReactiveFormsModule,
    IxInputComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    MatDialogClose,
    TranslateModule,
  ],
})
export class ManageDiskSedDialog implements OnInit {
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private loader = inject(LoaderService);
  private dialogRef = inject<MatDialogRef<ManageDiskSedDialog>>(MatDialogRef);
  private snackbar = inject(SnackbarService);
  private translate = inject(TranslateService);
  private diskName = inject(MAT_DIALOG_DATA);

  protected readonly requiredRoles = [Role.DiskWrite];

  passwordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  disk: Disk | undefined = undefined;

  readonly helptext = helptextDisks;

  ngOnInit(): void {
    this.loadDiskSedInfo();
  }

  onClearPassword(): void {
    this.setNewPassword('');
  }

  onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.setNewPassword(this.passwordControl.value);
  }

  private loadDiskSedInfo(): void {
    this.api.call('disk.query', [[['devname', '=', this.diskName]], { extra: { passwords: true } }])
      .pipe(
        this.loader.withLoader(),
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe((disks) => {
        this.disk = disks[0];
        this.passwordControl.setValue(this.disk.passwd || '');
      });
  }

  private setNewPassword(password: string): void {
    this.api.call('disk.update', [this.disk.identifier, { passwd: password }])
      .pipe(
        this.loader.withLoader(),
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.dialogRef.close(true);
        this.snackbar.success(this.translate.instant('SED password updated.'));
      });
  }
}
