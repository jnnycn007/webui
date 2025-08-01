import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { idNameArrayToOptions } from 'app/helpers/operators/options.operators';
import { helptextIscsi } from 'app/helptext/sharing';
import { AssociatedTargetDialogData, IscsiTargetExtentUpdate } from 'app/interfaces/iscsi.interface';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { LoaderService } from 'app/modules/loader/loader.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';

@UntilDestroy()
@Component({
  selector: 'ix-associated-target-form',
  styleUrls: ['./associated-target-form.component.scss'],
  templateUrl: './associated-target-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogContent,
    MatDialogTitle,
    MatDialogClose,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxSelectComponent,
    IxInputComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
    MatDialogActions,
  ],
})
export class AssociatedTargetFormComponent {
  private formBuilder = inject(FormBuilder);
  private api = inject(ApiService);
  private errorHandler = inject(FormErrorHandlerService);
  private loader = inject(LoaderService);
  data = inject<AssociatedTargetDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject<MatDialogRef<AssociatedTargetFormComponent>>(MatDialogRef);

  form = this.formBuilder.group({
    lunid: [null as number | null, [
      Validators.min(0),
      Validators.max(1023),
    ]],
    extent: [null as number | null, Validators.required],
  });

  isLoading = signal<boolean>(false);

  extents$ = of(this.data.extents).pipe(idNameArrayToOptions());

  readonly tooltips = {
    lunid: helptextIscsi.lunidTooltip,
    extent: helptextIscsi.existingExtentTooltip,
  };

  protected readonly requiredRoles = [
    Role.SharingIscsiTargetExtentWrite,
    Role.SharingIscsiWrite,
    Role.SharingWrite,
  ];

  onSubmit(): void {
    const values = {
      ...this.form.value,
      target: this.data.target.id,
    } as IscsiTargetExtentUpdate;

    this.isLoading.set(true);

    this.api.call('iscsi.targetextent.create', [values]).pipe(
      this.loader.withLoader(),
      untilDestroyed(this),
    ).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.dialogRef.close(response);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.errorHandler.handleValidationErrors(error, this.form);
      },
    });
  }
}
