import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { map, of } from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { SshSftpLogFacility, SshSftpLogLevel, SshWeakCipher } from 'app/enums/ssh.enum';
import { choicesToOptions } from 'app/helpers/operators/options.operators';
import { helptextServiceSsh } from 'app/helptext/services/components/service-ssh';
import { SshConfigUpdate } from 'app/interfaces/ssh-config.interface';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { ChipsProvider } from 'app/modules/forms/ix-forms/components/ix-chips/chips-provider';
import { IxChipsComponent } from 'app/modules/forms/ix-forms/components/ix-chips/ix-chips.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { IxTextareaComponent } from 'app/modules/forms/ix-forms/components/ix-textarea/ix-textarea.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { UserService } from 'app/services/user.service';

@UntilDestroy()
@Component({
  selector: 'ix-service-ssh',
  templateUrl: './service-ssh.component.html',
  styleUrls: ['./service-ssh.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxInputComponent,
    IxChipsComponent,
    IxCheckboxComponent,
    IxSelectComponent,
    IxTextareaComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class ServiceSshComponent implements OnInit {
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private formErrorHandler = inject(FormErrorHandlerService);
  private fb = inject(NonNullableFormBuilder);
  private userService = inject(UserService);
  private translate = inject(TranslateService);
  private snackbar = inject(SnackbarService);
  slideInRef = inject<SlideInRef<undefined, boolean>>(SlideInRef);

  protected readonly requiredRoles = [Role.SshWrite];

  protected isFormLoading = signal(false);
  isBasicMode = true;

  groupProvider: ChipsProvider = (query) => {
    return this.userService.groupQueryDsCache(query).pipe(
      map((groups) => groups.map((group) => group.group)),
    );
  };

  form = this.fb.group({
    tcpport: [null as number | null],
    password_login_groups: [[] as string[]],
    passwordauth: [false],
    kerberosauth: [false],
    tcpfwd: [false],
    bindiface: [[] as string[]],
    compression: [false],
    sftp_log_level: [null as SshSftpLogLevel | null],
    sftp_log_facility: [null as SshSftpLogFacility | null],
    weak_ciphers: [[] as SshWeakCipher[]],
    options: [''],
  });

  readonly tooltips = {
    tcpport: helptextServiceSsh.tcpportTooltip,
    password_login_groups: helptextServiceSsh.passwordLoginGroupsTooltip,
    passwordauth: helptextServiceSsh.passwordauthTooltip,
    kerberosauth: helptextServiceSsh.kerberosauthTooltip,
    tcpfwd: helptextServiceSsh.tcpfwdTooltip,
    bindiface: helptextServiceSsh.bindifaceTooltip,
    compression: helptextServiceSsh.compressionTooltip,
    sftp_log_level: helptextServiceSsh.sftpLogLevelTooltip,
    sftp_log_facility: helptextServiceSsh.sftpLogFacilityTooltip,
    weak_ciphers: helptextServiceSsh.weakCiphersTooltip,
    options: helptextServiceSsh.optionsTooltip,
  };

  readonly sftpLogLevels$ = of(helptextServiceSsh.sftpLogLevelOptions);
  readonly sftpLogFacilities$ = of(helptextServiceSsh.sftpLogFacilityOptions);
  readonly sshWeakCiphers$ = of(helptextServiceSsh.weakCiphersOptions);
  readonly bindInterfaces$ = this.api.call('ssh.bindiface_choices').pipe(choicesToOptions());

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });
  }

  ngOnInit(): void {
    this.isFormLoading.set(true);
    this.api.call('ssh.config').pipe(untilDestroyed(this)).subscribe({
      next: (config) => {
        this.form.patchValue(config);
        this.isFormLoading.set(false);
      },
      error: (error: unknown) => {
        this.isFormLoading.set(false);
        this.errorHandler.showErrorModal(error);
      },
    });
  }

  onAdvancedSettingsToggled(): void {
    this.isBasicMode = !this.isBasicMode;
  }

  onSubmit(): void {
    const values = this.form.value;

    this.isFormLoading.set(true);
    this.api.call('ssh.update', [values as SshConfigUpdate])
      .pipe(untilDestroyed(this))
      .subscribe({
        next: () => {
          this.isFormLoading.set(false);
          this.snackbar.success(this.translate.instant('Service configuration saved'));
          this.slideInRef.close({ response: true });
        },
        error: (error: unknown) => {
          this.isFormLoading.set(false);
          this.formErrorHandler.handleValidationErrors(error, this.form);
        },
      });
  }
}
