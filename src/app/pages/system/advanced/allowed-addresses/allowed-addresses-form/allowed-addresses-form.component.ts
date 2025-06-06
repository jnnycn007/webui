import {
  Component, ChangeDetectionStrategy, OnInit, signal,
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  Observable, of, switchMap, tap,
} from 'rxjs';
import { map } from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { helptextSystemAdvanced } from 'app/helptext/system/advanced';
import { helptextSystemGeneral } from 'app/helptext/system/general';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxListItemComponent } from 'app/modules/forms/ix-forms/components/ix-list/ix-list-item/ix-list-item.component';
import { IxListComponent } from 'app/modules/forms/ix-forms/components/ix-list/ix-list.component';
import { ipv4or6OptionalCidrValidator } from 'app/modules/forms/ix-forms/validators/ip-validation';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { AppState } from 'app/store';
import { generalConfigUpdated } from 'app/store/system-config/system-config.actions';

@UntilDestroy()
@Component({
  selector: 'ix-allowed-addresses-form',
  templateUrl: 'allowed-addresses-form.component.html',
  styleUrls: ['./allowed-addresses-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxListComponent,
    IxListItemComponent,
    IxInputComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class AllowedAddressesFormComponent implements OnInit {
  protected readonly requiredRoles = [Role.SystemGeneralWrite];
  protected readonly helpText = helptextSystemAdvanced;

  protected isFormLoading = signal(true);
  form = this.fb.nonNullable.group({
    addresses: this.fb.nonNullable.array<string>([]),
  });

  constructor(
    private fb: FormBuilder,
    private dialogService: DialogService,
    private api: ApiService,
    private errorHandler: ErrorHandlerService,
    private store$: Store<AppState>,
    private snackbar: SnackbarService,
    private translate: TranslateService,
    public slideInRef: SlideInRef<undefined, boolean>,
  ) {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });
  }

  ngOnInit(): void {
    this.api.call('system.general.config').pipe(untilDestroyed(this)).subscribe({
      next: (config) => {
        config.ui_allowlist.forEach(() => {
          this.addAddress();
        });
        this.form.controls.addresses.patchValue(config.ui_allowlist);
        this.isFormLoading.set(false);
      },
      error: (error: unknown) => {
        this.isFormLoading.set(false);
        this.errorHandler.showErrorModal(error);
      },
    });
  }

  addAddress(): void {
    this.form.controls.addresses.push(
      this.fb.nonNullable.control('', [Validators.required, ipv4or6OptionalCidrValidator()]),
    );
  }

  removeAddress(index: number): void {
    this.form.controls.addresses.removeAt(index);
  }

  handleServiceRestart(): Observable<true> {
    return this.dialogService.confirm({
      title: this.translate.instant(helptextSystemGeneral.restartTitle),
      message: this.translate.instant(helptextSystemGeneral.restartMessage),
    }).pipe(
      switchMap((shouldRestart): Observable<true> => {
        if (!shouldRestart) {
          return of(true);
        }
        return this.api.call('system.general.ui_restart').pipe(
          this.errorHandler.withErrorHandler(),
          map(() => true),
        );
      }),
    );
  }

  onSubmit(): void {
    this.isFormLoading.set(true);
    const addresses = this.form.getRawValue().addresses;

    this.api.call('system.general.update', [{ ui_allowlist: addresses }]).pipe(
      tap(() => {
        this.store$.dispatch(generalConfigUpdated());
        this.isFormLoading.set(false);
        this.snackbar.success(this.translate.instant('Allowed addresses have been updated'));
      }),
      switchMap(() => this.handleServiceRestart()),
      tap(() => {
        this.slideInRef.close({ response: true });
      }),
      untilDestroyed(this),
    ).subscribe({
      error: (error: unknown) => {
        this.isFormLoading.set(false);
        this.errorHandler.showErrorModal(error);
      },
    });
  }
}
