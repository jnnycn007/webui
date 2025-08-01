import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogClose,
} from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { mntPath } from 'app/enums/mnt-path.enum';
import { Role } from 'app/enums/role.enum';
import { TransferMode } from 'app/enums/transfer-mode.enum';
import { helptextCloudSync } from 'app/helptext/data-protection/cloudsync/cloudsync';
import { CloudSyncRestoreParams } from 'app/interfaces/cloudsync-provider.interface';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxExplorerComponent } from 'app/modules/forms/ix-forms/components/ix-explorer/ix-explorer.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { LoaderService } from 'app/modules/loader/loader.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { TransferModeExplanationComponent } from 'app/pages/data-protection/cloudsync/transfer-mode-explanation/transfer-mode-explanation.component';
import { FilesystemService } from 'app/services/filesystem.service';

@UntilDestroy()
@Component({
  selector: 'ix-cloudsync-restore-dialog',
  templateUrl: './cloudsync-restore-dialog.component.html',
  styleUrls: ['./cloudsync-restore-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    ReactiveFormsModule,
    IxInputComponent,
    IxSelectComponent,
    TransferModeExplanationComponent,
    IxExplorerComponent,
    FormActionsComponent,
    MatButton,
    MatDialogClose,
    TestDirective,
    RequiresRolesDirective,
    TranslateModule,
  ],
})
export class CloudSyncRestoreDialog {
  private api = inject(ApiService);
  private formBuilder = inject(FormBuilder);
  private filesystem = inject(FilesystemService);
  private translate = inject(TranslateService);
  private dialogRef = inject<MatDialogRef<CloudSyncRestoreDialog>>(MatDialogRef);
  private errorHandler = inject(FormErrorHandlerService);
  private loader = inject(LoaderService);
  private parentTaskId = inject(MAT_DIALOG_DATA);

  protected readonly requiredRoles = [Role.CloudSyncWrite];

  readonly form = this.formBuilder.nonNullable.group({
    description: ['', Validators.required],
    transfer_mode: [TransferMode.Copy],
    path: [mntPath, Validators.required],
  });

  readonly treeNodeProvider = this.filesystem.getFilesystemNodeProvider({ directoriesOnly: true });
  readonly helptext = helptextCloudSync;
  readonly transferModes$ = of([
    {
      value: TransferMode.Sync,
      label: this.translate.instant('SYNC'),
    },
    {
      value: TransferMode.Copy,
      label: this.translate.instant('COPY'),
    },
  ]);

  onSubmit(): void {
    this.api.call('cloudsync.restore', [this.parentTaskId, this.form.value] as CloudSyncRestoreParams)
      .pipe(this.loader.withLoader(), untilDestroyed(this))
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error: unknown) => {
          this.errorHandler.handleValidationErrors(error, this.form);
        },
      });
  }
}
