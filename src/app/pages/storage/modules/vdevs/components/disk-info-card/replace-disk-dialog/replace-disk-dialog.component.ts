import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogClose,
} from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { helptextVolumeStatus } from 'app/helptext/storage/volumes/volume-status';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { UnusedDiskSelectComponent } from 'app/modules/forms/custom-selects/unused-disk-select/unused-disk-select.component';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

export interface ReplaceDiskDialogData {
  diskName: string;
  guid: string;
  poolId: number;
}

@UntilDestroy()
@Component({
  selector: 'ix-replace-disk-dialog',
  templateUrl: './replace-disk-dialog.component.html',
  styleUrls: ['./replace-disk-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    ReactiveFormsModule,
    UnusedDiskSelectComponent,
    IxCheckboxComponent,
    FormActionsComponent,
    MatButton,
    TestDirective,
    MatDialogClose,
    RequiresRolesDirective,
    TranslateModule,
  ],
})
export class ReplaceDiskDialog {
  private formBuilder = inject(FormBuilder);
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private dialogRef = inject<MatDialogRef<ReplaceDiskDialog>>(MatDialogRef);
  private snackbar = inject(SnackbarService);
  data = inject<ReplaceDiskDialogData>(MAT_DIALOG_DATA);
  private dialogService = inject(DialogService);
  private errorHandler = inject(ErrorHandlerService);

  form = this.formBuilder.nonNullable.group({
    replacement: ['', Validators.required],
    preserve_settings: [true],
    preserve_description: [true],
    force: [false],
  });

  readonly helptext = helptextVolumeStatus;

  protected readonly Role = Role;

  onSubmit(): void {
    const values = this.form.getRawValue();
    this.dialogService.jobDialog(
      this.api.job('pool.replace', [this.data.poolId, {
        label: this.data.guid,
        disk: values.replacement,
        force: values.force,
        preserve_settings: values.preserve_settings,
        preserve_description: values.preserve_description,
      }]),
      { title: this.translate.instant(helptextVolumeStatus.replaceDisk.title) },
    )
      .afterClosed()
      .pipe(
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.dialogRef.close(true);
        this.snackbar.success(
          this.translate.instant('Successfully replaced disk {disk}.', { disk: this.data.diskName }),
        );
      });
  }
}
