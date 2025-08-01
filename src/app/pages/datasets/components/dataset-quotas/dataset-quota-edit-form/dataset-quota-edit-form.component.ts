import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { FormBuilder, FormControl } from '@ngneat/reactive-forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  EMPTY, Observable, of, switchMap,
} from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { DatasetQuotaType } from 'app/enums/dataset.enum';
import { Role } from 'app/enums/role.enum';
import { helptextGlobal } from 'app/helptext/global-helptext';
import { helptextQuotas } from 'app/helptext/storage/volumes/datasets/dataset-quotas';
import { DatasetQuota, SetDatasetQuota } from 'app/interfaces/dataset-quota.interface';
import { QueryFilter, QueryParams } from 'app/interfaces/query-api.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { IxFormatterService } from 'app/modules/forms/ix-forms/services/ix-formatter.service';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';

@UntilDestroy()
@Component({
  selector: 'ix-dataset-quota-edit-form',
  templateUrl: './dataset-quota-edit-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxInputComponent,
    FormActionsComponent,
    MatButton,
    RequiresRolesDirective,
    TestDirective,
    TranslateModule,
  ],
})
export class DatasetQuotaEditFormComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  formatter = inject(IxFormatterService);
  private errorHandler = inject(FormErrorHandlerService);
  private snackbar = inject(SnackbarService);
  protected dialogService = inject(DialogService);
  slideInRef = inject<SlideInRef<{
    quotaType: DatasetQuotaType;
    datasetId: string;
    id: number;
  }, boolean>>(SlideInRef);

  protected readonly requiredRoles = [Role.DatasetWrite];

  protected isFormLoading = signal(false);
  private datasetQuota: DatasetQuota;
  private datasetId: string;
  private quotaType: DatasetQuotaType;
  private id: number;

  get title(): string {
    return this.quotaType === DatasetQuotaType.User
      ? this.translate.instant('Edit User Quota')
      : this.translate.instant('Edit Group Quota');
  }

  get nameLabel(): string {
    return this.quotaType === DatasetQuotaType.User
      ? helptextQuotas.users.nameLabel
      : helptextQuotas.groups.nameLabel;
  }

  get dataQuotaLabel(): string {
    return this.quotaType === DatasetQuotaType.User
      ? this.getUserDataQuotaLabel()
      : this.getGroupDataQuotaLabel();
  }

  private getUserDataQuotaLabel(): string {
    return this.translate.instant(helptextQuotas.users.dataQuota.label)
      + this.translate.instant(helptextGlobal.humanReadable.suggestionLabel);
  }

  private getGroupDataQuotaLabel(): string {
    return this.translate.instant(helptextQuotas.groups.dataQuota.label)
      + this.translate.instant(helptextGlobal.humanReadable.suggestionLabel);
  }

  get objectQuotaLabel(): string {
    return this.quotaType === DatasetQuotaType.User
      ? helptextQuotas.users.objQuota.label
      : helptextQuotas.groups.objectQuota.label;
  }

  get dataQuotaTooltip(): string {
    return this.quotaType === DatasetQuotaType.User
      ? this.getUserDataQuotaTooltip()
      : this.getGroupDataQuotaTooltip();
  }

  private getUserDataQuotaTooltip(): string {
    return this.translate.instant(helptextQuotas.users.dataQuota.tooltip)
      + this.translate.instant(helptextGlobal.humanReadable.suggestionTooltip)
      + this.translate.instant(' bytes.');
  }

  private getGroupDataQuotaTooltip(): string {
    return this.translate.instant(helptextQuotas.groups.dataQuota.tooltip)
      + this.translate.instant(helptextGlobal.humanReadable.suggestionTooltip)
      + this.translate.instant(' bytes.');
  }

  get objectQuotaTooltip(): string {
    return this.quotaType === DatasetQuotaType.User
      ? helptextQuotas.users.objQuota.tooltip
      : helptextQuotas.groups.objectQuota.tooltip;
  }

  form = this.formBuilder.group({
    name: [''],
    data_quota: new FormControl(null as number | null),
    obj_quota: new FormControl(null as number | null),
  });

  constructor() {
    const slideInRef = this.slideInRef;

    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });

    this.datasetId = slideInRef.getData().datasetId;
    this.quotaType = slideInRef.getData().quotaType;
    this.id = slideInRef.getData().id;
  }

  ngOnInit(): void {
    this.setupEditQuotaForm();
  }

  private setupEditQuotaForm(): void {
    this.updateForm();
  }

  private updateForm(): void {
    this.isFormLoading.set(true);
    this.getQuota(this.id).pipe(
      tap((quotas) => {
        this.datasetQuota = quotas[0];
        this.isFormLoading.set(false);
        this.form.patchValue({
          name: this.datasetQuota.name || '',
          data_quota: this.datasetQuota.quota || null,
          obj_quota: this.datasetQuota.obj_quota,
        });
      }),
      catchError((error: unknown) => {
        this.isFormLoading.set(false);
        this.errorHandler.handleValidationErrors(error, this.form);
        return EMPTY;
      }),
      untilDestroyed(this),
    ).subscribe();
  }

  private getQuota(id: number): Observable<DatasetQuota[]> {
    const params = [['id', '=', id] as QueryFilter<DatasetQuota>] as QueryParams<DatasetQuota>;
    return this.api.call('pool.dataset.get_quota', [this.datasetId, this.quotaType, params]);
  }

  protected onSubmit(): void {
    const values = this.form.value;
    const payload: SetDatasetQuota[] = [];
    payload.push({
      quota_type: this.quotaType,
      id: String(this.datasetQuota.id),
      quota_value: values.data_quota || 0,
    });
    payload.push({
      quota_type: this.quotaType === DatasetQuotaType.User
        ? DatasetQuotaType.UserObj
        : DatasetQuotaType.GroupObj,
      id: String(this.datasetQuota.id),
      quota_value: values.obj_quota || 0,
    });

    this.submit(values, payload);
  }

  private submit(values: typeof this.form.value, payload: SetDatasetQuota[]): void {
    let canSubmit$ = of(true);
    if (this.isUnsettingQuota(values)) {
      canSubmit$ = this.getConfirmation(values.name);
    }

    canSubmit$.pipe(
      filter(Boolean),
      switchMap(() => {
        this.isFormLoading.set(true);
        return this.api.call('pool.dataset.set_quota', [this.datasetId, payload]);
      }),
      untilDestroyed(this),
    ).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('Quotas updated'));
        this.isFormLoading.set(false);
        this.slideInRef.close({ response: true });
      },
      error: (error: unknown) => {
        this.isFormLoading.set(false);
        this.errorHandler.handleValidationErrors(error, this.form);
      },
    });
  }

  private isUnsettingQuota(values: typeof this.form.value): boolean {
    return !values.data_quota && !values.obj_quota;
  }

  private getConfirmation(name: string): Observable<boolean> {
    return this.dialogService.confirm({
      title: this.quotaType === DatasetQuotaType.User
        ? this.translate.instant('Delete User Quota')
        : this.translate.instant('Delete Group Quota'),
      message: this.quotaType === DatasetQuotaType.User
        ? this.translate.instant('Are you sure you want to delete the user quota <b>{name}</b>?', { name })
        : this.translate.instant('Are you sure you want to delete the group quota <b>{name}</b>?', { name }),
      buttonText: this.translate.instant('Delete'),
    });
  }
}
