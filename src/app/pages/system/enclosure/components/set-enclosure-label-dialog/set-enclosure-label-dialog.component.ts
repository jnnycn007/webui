import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogClose,
} from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxValidatorsService } from 'app/modules/forms/ix-forms/services/ix-validators.service';
import { LoaderService } from 'app/modules/loader/loader.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

export interface SetEnclosureLabelDialogData {
  enclosureId: string;
  currentLabel: string;
  defaultLabel: string;
}

@UntilDestroy()
@Component({
  selector: 'ix-set-enclosure-label-dialog',
  templateUrl: './set-enclosure-label-dialog.component.html',
  styleUrls: ['./set-enclosure-label-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    ReactiveFormsModule,
    IxInputComponent,
    IxCheckboxComponent,
    FormActionsComponent,
    MatButton,
    TestDirective,
    MatDialogClose,
    TranslateModule,
  ],
})
export class SetEnclosureLabelDialog implements OnInit {
  private formBuilder = inject(FormBuilder);
  private api = inject(ApiService);
  private loader = inject(LoaderService);
  private dialogRef = inject<MatDialogRef<SetEnclosureLabelDialog, string>>(MatDialogRef);
  private errorHandler = inject(ErrorHandlerService);
  private validatorsService = inject(IxValidatorsService);
  private translate = inject(TranslateService);
  private data = inject<SetEnclosureLabelDialogData>(MAT_DIALOG_DATA);

  enclosureLabel = 'Enclosure Label';

  form = this.formBuilder.nonNullable.group({
    label: ['', [
      Validators.required,
      this.validatorsService.withMessage(
        Validators.pattern('^(?!\\s*$).+'),
        this.translate.instant(`${this.enclosureLabel} cannot contain only whitespace characters.`),
      )]],
    resetToDefault: [false],
  });

  ngOnInit(): void {
    this.form.patchValue({
      label: this.data.currentLabel,
    });

    this.setFormRelationship();
  }

  onSubmit(): void {
    const formValues = this.form.getRawValue();
    const newLabel = formValues.resetToDefault ? this.data.defaultLabel : formValues.label;

    this.api.call('enclosure.label.set', [this.data.enclosureId, newLabel])
      .pipe(this.loader.withLoader(), untilDestroyed(this))
      .subscribe({
        next: () => {
          this.dialogRef.close(newLabel);
        },
        error: (error: unknown) => {
          this.errorHandler.showErrorModal(error);
          this.dialogRef.close();
        },
      });
  }

  private setFormRelationship(): void {
    this.form.controls.resetToDefault.valueChanges.pipe(untilDestroyed(this)).subscribe((resetToDefault) => {
      if (resetToDefault) {
        this.form.controls.label.disable();
      } else {
        this.form.controls.label.enable();
      }
    });
  }
}
