import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose,
} from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { helptextAcl } from 'app/helptext/storage/volumes/datasets/dataset-acl';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

export interface StripAclModalData {
  path: string;
}

@UntilDestroy()
@Component({
  selector: 'ix-strip-acl-modal',
  templateUrl: './strip-acl-modal.component.html',
  styleUrls: ['./strip-acl-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    IxCheckboxComponent,
    ReactiveFormsModule,
    FormActionsComponent,
    MatDialogActions,
    MatButton,
    TestDirective,
    MatDialogClose,
    TranslateModule,
  ],
})
export class StripAclModalComponent {
  private api = inject(ApiService);
  private dialog = inject(DialogService);
  private errorHandler = inject(ErrorHandlerService);
  private dialogRef = inject<MatDialogRef<StripAclModalComponent>>(MatDialogRef);
  private translate = inject(TranslateService);
  data = inject<StripAclModalData>(MAT_DIALOG_DATA);

  traverseCheckbox = new FormControl(false);

  readonly helptext = helptextAcl;

  onStrip(): void {
    const job$ = this.api.job('filesystem.setacl', [{
      path: this.data.path,
      dacl: [],
      options: {
        recursive: true,
        traverse: Boolean(this.traverseCheckbox.value),
        stripacl: true,
      },
    }]);

    this.dialog.jobDialog(
      job$,
      {
        title: this.translate.instant('Stripping ACLs'),
      },
    )
      .afterClosed()
      .pipe(
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.dialogRef.close(true);
      });
  }
}
