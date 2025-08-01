import { ChangeDetectionStrategy, Component, OnInit, ViewContainerRef, viewChild, signal, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { combineLatest, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { CloudSyncProviderName } from 'app/enums/cloudsync-provider.enum';
import { Role } from 'app/enums/role.enum';
import { helptextSystemCloudcredentials as helptext } from 'app/helptext/system/cloud-credentials';
import { CloudSyncCredential, CloudSyncCredentialUpdate } from 'app/interfaces/cloudsync-credential.interface';
import { CloudSyncProvider } from 'app/interfaces/cloudsync-provider.interface';
import { Option } from 'app/interfaces/option.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { forbiddenValues } from 'app/modules/forms/ix-forms/validators/forbidden-values-validation/forbidden-values-validation';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import {
  BaseProviderFormComponent,
} from 'app/pages/credentials/backup-credentials/cloud-credentials-form/provider-forms/base-provider-form';
import { CloudSyncProviderDescriptionComponent } from 'app/pages/data-protection/cloudsync/cloudsync-provider-description/cloudsync-provider-description.component';
import { getName, getProviderFormClass } from 'app/pages/data-protection/cloudsync/cloudsync-wizard/steps/cloudsync-provider/cloudsync-provider.common';
import { CloudCredentialService } from 'app/services/cloud-credential.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

export interface CloudCredentialFormInput {
  providers: CloudSyncProviderName[];
  existingCredential: CloudSyncCredential;
}

// TODO: Form is partially backend driven and partially hardcoded on the frontend.
@UntilDestroy()
@Component({
  selector: 'ix-cloud-credentials-form',
  templateUrl: './cloud-credentials-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxSelectComponent,
    CloudSyncProviderDescriptionComponent,
    IxInputComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class CloudCredentialsFormComponent implements OnInit {
  private api = inject(ApiService);
  private formBuilder = inject(FormBuilder);
  private errorHandler = inject(ErrorHandlerService);
  private dialogService = inject(DialogService);
  private formErrorHandler = inject(FormErrorHandlerService);
  private translate = inject(TranslateService);
  private snackbarService = inject(SnackbarService);
  private cloudCredentialService = inject(CloudCredentialService);
  slideInRef = inject<SlideInRef<CloudCredentialFormInput, CloudSyncCredential | null>>(SlideInRef);

  protected readonly requiredRoles = [Role.CloudSyncWrite];

  commonForm = this.formBuilder.nonNullable.group({
    name: ['Storj', Validators.required],
    type: [CloudSyncProviderName.Storj],
  });

  protected isLoading = signal(false);
  existingCredential: CloudSyncCredential;
  limitProviders: CloudSyncProviderName[];
  providers: CloudSyncProvider[] = [];
  providerOptions = of<Option[]>([]);
  providerForm: BaseProviderFormComponent;
  forbiddenNames: string[] = [];
  credentials: CloudSyncCredential[] = [];

  private readonly providerFormContainer = viewChild.required('providerFormContainer', { read: ViewContainerRef });

  readonly helptext = helptext;

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.commonForm.dirty || this.providerForm.form.dirty);
    });

    const data = this.slideInRef.getData();
    this.existingCredential = data?.existingCredential;
    this.limitProviders = data?.providers;
    // Has to be earlier than potential `setCredentialsForEdit` call
    this.setFormEvents();
  }

  get showProviderDescription(): boolean {
    return this.commonForm.controls.type.enabled
      && this.commonForm.controls.type.value === CloudSyncProviderName.Storj;
  }

  get isNew(): boolean {
    return !this.existingCredential;
  }

  get selectedProvider(): CloudSyncProvider | undefined {
    return this.providers?.find((provider) => {
      return provider.name === this.commonForm.controls.type.value;
    });
  }

  get areActionsDisabled(): boolean {
    return this.isLoading()
      || this.commonForm.invalid
      || this.providerForm?.form?.invalid;
  }

  ngOnInit(): void {
    this.loadProviders();

    if (this.existingCredential) {
      this.setCredentialsForEdit();
    }
  }

  setCredentialsForEdit(): void {
    this.commonForm.setValue({
      name: this.existingCredential.name,
      type: this.existingCredential.provider.type,
    });

    if (this.providerForm) {
      this.providerForm.getFormSetter$().next(this.existingCredential.provider);
    }
  }

  protected onSubmit(): boolean {
    this.isLoading.set(true);

    this.providerForm.beforeSubmit()
      .pipe(
        switchMap(() => {
          const payload = this.preparePayload();
          return this.isNew
            ? this.api.call('cloudsync.credentials.create', [payload])
            : this.api.call('cloudsync.credentials.update', [this.existingCredential.id, payload]);
        }),
        untilDestroyed(this),
      )
      .subscribe({
        next: (response) => {
          this.isLoading.set(false);
          this.snackbarService.success(
            this.isNew
              ? this.translate.instant('Cloud credential added.')
              : this.translate.instant('Cloud credential updated.'),
          );
          this.slideInRef.close({ response });
        },
        error: (error: unknown) => {
          // TODO: Errors for nested provider form will be shown in a modal. Can be improved.
          this.isLoading.set(false);
          this.formErrorHandler.handleValidationErrors(error, this.commonForm);
        },
      });

    return false;
  }

  protected onVerify(): void {
    this.isLoading.set(true);

    this.providerForm.beforeSubmit()
      .pipe(
        switchMap(() => {
          const payload = this.preparePayload();

          return this.api.call('cloudsync.credentials.verify', [payload.provider]);
        }),
        untilDestroyed(this),
      )
      .subscribe({
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

          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.formErrorHandler.handleValidationErrors(error, this.commonForm);
        },
      });
  }

  private preparePayload(): CloudSyncCredentialUpdate {
    const commonValues = this.commonForm.getRawValue();
    return {
      name: commonValues.name,
      provider: {
        ...this.providerForm.getSubmitAttributes(),
        type: commonValues.type,
      },
    };
  }

  private loadProviders(): void {
    this.isLoading.set(true);
    combineLatest([
      this.cloudCredentialService.getProviders(),
      this.cloudCredentialService.getCloudSyncCredentials(),
    ])
      .pipe(untilDestroyed(this))
      .subscribe({
        next: ([providers, credentials]) => {
          if (this.limitProviders?.length) {
            providers = providers.filter((provider) => this.limitProviders.includes(provider.name));
          }
          this.providers = providers;
          this.providerOptions = of(
            providers.map((provider) => ({
              label: provider.title,
              value: provider.name,
            })),
          );
          this.credentials = credentials;
          this.setNamesInUseValidator(credentials);
          this.renderProviderForm();
          if (this.existingCredential) {
            this.providerForm.getFormSetter$().next(this.existingCredential.provider);
          }
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.errorHandler.showErrorModal(error);
        },
      });
  }

  private setFormEvents(): void {
    this.commonForm.controls.type.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        this.renderProviderForm();

        this.setDefaultName();
      });
  }

  private setNamesInUseValidator(credentials: CloudSyncCredential[]): void {
    this.forbiddenNames = credentials.map((credential) => credential.name);
    this.commonForm.controls.name.addValidators(forbiddenValues(this.forbiddenNames));
  }

  private setDefaultName(): void {
    if (!this.isNew || this.commonForm.controls.name.touched) {
      return;
    }

    this.commonForm.controls.name.setValue(getName(this.selectedProvider?.title || '', this.forbiddenNames));
  }

  private renderProviderForm(): void {
    this.providerFormContainer()?.clear();
    if (!this.selectedProvider) {
      return;
    }

    const formClass = getProviderFormClass(this.selectedProvider.name);
    const formRef = this.providerFormContainer().createComponent(formClass);
    formRef.instance.provider = this.selectedProvider;
    this.providerForm = formRef.instance;
  }
}
