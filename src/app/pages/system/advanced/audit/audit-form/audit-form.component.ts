import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { Validators, ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  EMPTY,
  of,
} from 'rxjs';
import {
  catchError, tap,
} from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { helptextSystemAdvanced as helptext } from 'app/helptext/system/advanced';
import { AuditConfig } from 'app/interfaces/audit/audit.interface';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { AppState } from 'app/store';
import { advancedConfigUpdated } from 'app/store/system-config/system-config.actions';

@UntilDestroy()
@Component({
  selector: 'ix-audit-form',
  templateUrl: 'audit-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxInputComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class AuditFormComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private store$ = inject<Store<AppState>>(Store);
  private snackbar = inject(SnackbarService);
  private translate = inject(TranslateService);
  private formErrorHandler = inject(FormErrorHandlerService);
  slideInRef = inject<SlideInRef<undefined, boolean>>(SlideInRef);

  protected readonly requiredRoles = [Role.SystemAuditWrite];

  protected isFormLoading = signal(false);

  readonly form = this.fb.group({
    retention: [null as number | null, [Validators.required, Validators.min(1), Validators.max(30)]],
    reservation: [null as number | null, [Validators.required, Validators.min(0), Validators.max(100)]],
    quota: [null as number | null, [Validators.required, Validators.min(0), Validators.max(100)]],
    quota_fill_warning: [null as number | null, [Validators.required, Validators.min(5), Validators.max(80)]],
    quota_fill_critical: [null as number | null, [Validators.required, Validators.min(50), Validators.max(95)]],
  });

  readonly tooltips = {
    retention: helptext.retentionTooltip,
    reservation: helptext.reservationTooltip,
    quota: helptext.quotaTooltip,
    quota_fill_warning: helptext.quotaFillWarningTooltip,
    quota_fill_critical: helptext.quotaFillCriticalTooltip,
  };

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });
  }

  ngOnInit(): void {
    this.loadForm();
  }

  protected onSubmit(): void {
    const configUpdate = this.form.value as AuditConfig;
    this.isFormLoading.set(true);
    this.api.call('audit.update', [configUpdate]).pipe(
      tap(() => {
        this.snackbar.success(this.translate.instant('Settings saved'));
        this.store$.dispatch(advancedConfigUpdated());
        this.isFormLoading.set(false);
        this.slideInRef.close({ response: true });
      }),
      catchError((error: unknown) => {
        this.isFormLoading.set(false);
        this.formErrorHandler.handleValidationErrors(error, this.form);
        return EMPTY;
      }),
      untilDestroyed(this),
    ).subscribe();
  }

  private loadForm(): void {
    this.isFormLoading.set(true);

    this.api.call('audit.config').pipe(untilDestroyed(this))
      .subscribe({
        next: (auditConfig) => {
          this.isFormLoading.set(false);
          this.form.patchValue({
            ...auditConfig,
          });
        },
        error: (error: unknown) => {
          this.isFormLoading.set(false);
          this.errorHandler.showErrorModal(error);
        },
      });
  }
}
