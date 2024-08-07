import {
  ChangeDetectionStrategy, Component,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { LoginResult } from 'app/enums/login-result.enum';
import { RadioOption } from 'app/interfaces/option.interface';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { matchOthersFgValidator } from 'app/modules/forms/ix-forms/validators/password-validation/password-validation';
import { AuthService } from 'app/services/auth/auth.service';
import { WebSocketService } from 'app/services/ws.service';
import { SigninStore } from 'app/views/sessions/signin/store/signin.store';

const adminUsername = 'truenas_admin';

@UntilDestroy()
@Component({
  selector: 'ix-set-admin-password-form',
  templateUrl: './set-admin-password-form.component.html',
  styleUrls: ['./set-admin-password-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetAdminPasswordFormComponent {
  isLoading$ = this.signinStore.isLoading$;

  form = this.formBuilder.group({
    username: [adminUsername, Validators.required],
    password: ['', Validators.required],
    password2: ['', [
      Validators.required,
    ]],
  }, {
    validators: [
      matchOthersFgValidator(
        'password2',
        ['password'],
        this.translate.instant('Passwords do not match'),
      ),
    ],
  });

  readonly usernameOptions$: Observable<RadioOption[]> = of([
    { label: `${this.translate.instant('Administrative user')} (${adminUsername})`, value: adminUsername },
    { label: this.translate.instant('Root user (not recommended)'), value: 'root' },
  ]);

  constructor(
    private formBuilder: FormBuilder,
    private ws: WebSocketService,
    private authService: AuthService,
    private errorHandler: FormErrorHandlerService,
    private translate: TranslateService,
    private signinStore: SigninStore,
  ) { }

  onSubmit(): void {
    const { username, password } = this.form.value;
    this.signinStore.setLoadingState(true);

    const request$ = this.ws.call('user.setup_local_administrator', [username, password]);

    request$.pipe(
      switchMap(() => this.authService.login(username, password)),
      untilDestroyed(this),
    ).subscribe({
      next: (loginResult) => {
        this.signinStore.setLoadingState(false);

        if (loginResult === LoginResult.Success) {
          this.signinStore.handleSuccessfulLogin();
        } else {
          this.signinStore.showSnackbar(this.translate.instant('Login error. Please try again.'));
        }
      },
      error: (error: unknown) => {
        this.errorHandler.handleWsFormError(error, this.form);
        this.signinStore.setLoadingState(false);
      },
    });
  }
}
