import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { WINDOW } from 'app/helpers/window.helper';
import { helptextSystemSupport as helptext } from 'app/helptext/system/support';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxTextareaComponent } from 'app/modules/forms/ix-forms/components/ix-textarea/ix-textarea.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';

@UntilDestroy()
@Component({
  selector: 'ix-license',
  templateUrl: './license.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxTextareaComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class LicenseComponent {
  private fb = inject(FormBuilder);
  private dialogService = inject(DialogService);
  protected api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private errorHandler = inject(FormErrorHandlerService);
  private translate = inject(TranslateService);
  slideInRef = inject<SlideInRef<undefined, boolean>>(SlideInRef);
  private window = inject<Window>(WINDOW);

  protected readonly requiredRoles = [Role.FullAdmin];

  isFormLoading = false;

  title = helptext.updateLicense.licensePlaceholder;
  form = this.fb.nonNullable.group({
    license: ['', Validators.required],
  });

  license = {
    fcName: 'license',
    label: helptext.updateLicense.licensePlaceholder,
  };

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });
  }

  onSubmit(): void {
    this.isFormLoading = true;

    const { license } = this.form.getRawValue();
    this.api.call('system.license_update', [license]).pipe(untilDestroyed(this)).subscribe({
      next: () => {
        this.isFormLoading = false;
        this.slideInRef.close({ response: true });
        this.cdr.markForCheck();
        this.dialogService
          .confirm({
            title: this.translate.instant(helptext.updateLicense.reloadDialogTitle),
            message: this.translate.instant(helptext.updateLicense.reloadDialogMessage),
            hideCheckbox: true,
            buttonText: this.translate.instant(helptext.updateLicense.reloadDialogAction),
            hideCancel: true,
            disableClose: true,
          })
          // Deliberate. Keeps subscribe effect going after form is closed.
          // eslint-disable-next-line rxjs-angular/prefer-takeuntil
          .subscribe(() => {
            this.window.location.reload();
          });
      },
      error: (error: unknown) => {
        this.isFormLoading = false;
        this.errorHandler.handleValidationErrors(error, this.form);
        this.cdr.markForCheck();
      },
    });
  }
}
