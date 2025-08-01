import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogClose,
} from '@angular/material/dialog';
import { FormBuilder } from '@ngneat/reactive-forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { helptextReplication } from 'app/helptext/data-protection/replication/replication';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxExplorerComponent } from 'app/modules/forms/ix-forms/components/ix-explorer/ix-explorer.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { LoaderService } from 'app/modules/loader/loader.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { DatasetService } from 'app/services/dataset/dataset.service';

@UntilDestroy()
@Component({
  selector: 'ix-replication-restore-dialog',
  templateUrl: './replication-restore-dialog.component.html',
  styleUrls: ['./replication-restore-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    ReactiveFormsModule,
    IxInputComponent,
    IxExplorerComponent,
    FormActionsComponent,
    MatButton,
    TestDirective,
    MatDialogClose,
    RequiresRolesDirective,
    TranslateModule,
  ],
})
export class ReplicationRestoreDialog {
  private api = inject(ApiService);
  private loader = inject(LoaderService);
  private formBuilder = inject(FormBuilder);
  private datasetService = inject(DatasetService);
  private dialogRef = inject<MatDialogRef<ReplicationRestoreDialog>>(MatDialogRef);
  private errorHandler = inject(FormErrorHandlerService);
  private parentTaskId = inject(MAT_DIALOG_DATA);

  protected readonly requiredRoles = [Role.ReplicationTaskWrite, Role.ReplicationTaskWritePull];

  form = this.formBuilder.group({
    name: ['', Validators.required],
    target_dataset: ['', Validators.required],
  });

  readonly treeNodeProvider = this.datasetService.getDatasetNodeProvider();
  readonly helptext = helptextReplication;

  onSubmit(): void {
    this.api.call('replication.restore', [this.parentTaskId, this.form.value])
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
