import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatStepperNext } from '@angular/material/stepper';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  catchError, EMPTY, pairwise, startWith,
} from 'rxjs';
import { helptextSystemCloudcredentials as helptext } from 'app/helptext/system/cloud-credentials';
import { CloudSyncCredential } from 'app/interfaces/cloudsync-credential.interface';
import { newOption } from 'app/interfaces/option.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { CloudCredentialsSelectComponent } from 'app/modules/forms/custom-selects/cloud-credentials-select/cloud-credentials-select.component';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { addNewIxSelectValue } from 'app/modules/forms/ix-forms/components/ix-select/ix-select-with-new-option.directive';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { CloudSyncFormComponent } from 'app/pages/data-protection/cloudsync/cloudsync-form/cloudsync-form.component';
import { CloudCredentialService } from 'app/services/cloud-credential.service';

@UntilDestroy()
@Component({
  selector: 'ix-cloudsync-provider',
  templateUrl: './cloudsync-provider.component.html',
  styleUrls: ['./cloudsync-provider.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IxFieldsetComponent,
    CloudCredentialsSelectComponent,
    FormActionsComponent,
    MatButton,
    MatStepperNext,
    TestDirective,
    TranslateModule,
  ],
})
export class CloudSyncProviderComponent implements OnInit {
  private api = inject(ApiService);
  private formBuilder = inject(FormBuilder);
  private slideInRef = inject<SlideInRef<unknown, unknown>>(SlideInRef);
  private cdr = inject(ChangeDetectorRef);
  private dialogService = inject(DialogService);
  private formErrorHandler = inject(FormErrorHandlerService);
  private translate = inject(TranslateService);
  private cloudCredentialService = inject(CloudCredentialService);
  private snackbarService = inject(SnackbarService);

  readonly save = output<CloudSyncCredential>();
  readonly loading = output<boolean>();

  protected form = this.formBuilder.group({
    exist_credential: [null as number | typeof newOption | null],
  });

  protected isLoading: boolean;

  private credentials: CloudSyncCredential[] = [];
  private existingCredential: CloudSyncCredential;

  readonly helptext = helptext;

  get areActionsDisabled(): boolean {
    return this.isLoading || this.form.invalid || !this.form.controls.exist_credential.value;
  }

  ngOnInit(): void {
    this.setFormEvents();
    this.subToLoading();
    this.getExistingCredentials();
  }

  private getExistingCredentials(): void {
    this.loading.emit(true);
    this.cloudCredentialService.getCloudSyncCredentials()
      .pipe(
        catchError((error: unknown) => {
          this.loading.emit(false);
          this.formErrorHandler.handleValidationErrors(error, this.form);
          this.cdr.markForCheck();
          return EMPTY;
        }),
        untilDestroyed(this),
      ).subscribe({
        next: (creds) => {
          this.credentials = creds;
        },
        complete: () => {
          this.loading.emit(false);
        },
      });
  }

  private subToLoading(): void {
    this.loading.subscribe((isLoading) => this.isLoading = isLoading);
  }

  onSubmit(): void {
    this.save.emit(this.existingCredential);
  }

  onVerify(): void {
    this.loading.emit(true);

    const payload = this.existingCredential.provider;
    this.api.call('cloudsync.credentials.verify', [payload]).pipe(
      untilDestroyed(this),
    ).subscribe({
      next: (response) => {
        if (response.valid) {
          this.snackbarService.success(this.translate.instant('The credentials are valid.'));
        } else {
          this.dialogService.error({
            title: this.translate.instant('Error'),
            message: response.excerpt || '',
            stackTrace: response.error,
          });
        }

        this.loading.emit(false);
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.loading.emit(false);
        this.formErrorHandler.handleValidationErrors(error, this.form);
        this.cdr.markForCheck();
      },
    });
  }

  openAdvanced(): void {
    this.slideInRef.swap?.(CloudSyncFormComponent, { wide: true });
  }

  private setFormEvents(): void {
    this.form.controls.exist_credential.valueChanges
      .pipe(
        startWith(undefined),
        pairwise(),
        untilDestroyed(this),
      ).subscribe(([previousCreds, currentCreds]) => {
        const isPreviousValueAddNew = previousCreds != null && previousCreds.toString() === addNewIxSelectValue;
        const isCurrentValueExists = currentCreds != null;
        const isCurrentValueAddNew = isCurrentValueExists && currentCreds.toString() === addNewIxSelectValue;

        if (!isCurrentValueExists || isCurrentValueAddNew) {
          return;
        }

        if (!isPreviousValueAddNew) {
          this.emitSelectedCredential(currentCreds as number);
          return;
        }

        this.loading.emit(true);
        this.cloudCredentialService.getCloudSyncCredentials().pipe(untilDestroyed(this)).subscribe({
          next: (creds) => {
            this.credentials = creds;
            this.emitSelectedCredential(currentCreds as number);
          },
          complete: () => {
            this.loading.emit(false);
          },
        });
      });
  }

  private emitSelectedCredential(credsId: number): void {
    this.existingCredential = this.credentials.find((credential) => credential.id === credsId);
    this.save.emit(this.existingCredential);
    this.cdr.markForCheck();
  }

  isDirty(): boolean {
    return this.form.dirty;
  }
}
