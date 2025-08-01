import { Component, ChangeDetectionStrategy, input, output, signal, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { filter, of, switchMap } from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { ActionOption } from 'app/interfaces/option.interface';
import { User } from 'app/interfaces/user.interface';
import { AuthService } from 'app/modules/auth/auth.service';
import { FormatDateTimePipe } from 'app/modules/dates/pipes/format-date-time/format-datetime.pipe';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { IxTableExpandableRowComponent } from 'app/modules/ix-table/components/ix-table-expandable-row/ix-table-expandable-row.component';
import { LoaderService } from 'app/modules/loader/loader.service';
import { YesNoPipe } from 'app/modules/pipes/yes-no/yes-no.pipe';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { OneTimePasswordCreatedDialog } from 'app/pages/credentials/users/one-time-password-created-dialog/one-time-password-created-dialog.component';
import {
  OldDeleteUserDialog,
} from 'app/pages/credentials/users/user-details-row/delete-user-dialog/delete-user-dialog.component';
import { OldUserFormComponent } from 'app/pages/credentials/users/user-form/user-form.component';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { UrlOptionsService } from 'app/services/url-options.service';

@UntilDestroy()
@Component({
  selector: 'ix-user-details-row',
  templateUrl: './user-details-row.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxTableExpandableRowComponent,
    MatButton,
    TestDirective,
    IxIconComponent,
    RequiresRolesDirective,
    TranslateModule,
  ],
  providers: [
    FormatDateTimePipe,
  ],
})
export class UserDetailsRowComponent implements OnInit {
  private translate = inject(TranslateService);
  private slideIn = inject(SlideIn);
  private matDialog = inject(MatDialog);
  private yesNoPipe = inject(YesNoPipe);
  private formatDateTime = inject(FormatDateTimePipe);
  private urlOptions = inject(UrlOptionsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private loader = inject(LoaderService);

  readonly user = input.required<User>();
  readonly delete = output<number>();

  loggedInUser = toSignal(this.authService.user$.pipe(filter(Boolean)));
  isStigMode = signal<boolean>(false);

  protected readonly Role = Role;

  ngOnInit(): void {
    this.api.call('system.security.config').pipe(untilDestroyed(this)).subscribe((config) => {
      this.isStigMode.set(config.enable_gpos_stig);
    });
  }

  getDetails(user: User): ActionOption[] {
    const details = [
      {
        label: this.translate.instant('API Keys'),
        value: this.translate.instant('{n, plural, =0 {No keys} =1 {# key} other {# keys}}', {
          n: user.api_keys?.length,
        }),
        action: () => this.viewUserApiKeys(user),
      },
      { label: this.translate.instant('GID'), value: user?.group?.bsdgrp_gid },
      { label: this.translate.instant('Home Directory'), value: user.home },
      { label: this.translate.instant('Shell'), value: user.shell },
      { label: this.translate.instant('Email'), value: user.email },
      {
        label: this.translate.instant('Password Disabled'),
        value: this.yesNoPipe.transform(user.password_disabled),
      },
      {
        label: this.translate.instant('Lock User'),
        value: this.yesNoPipe.transform(user.locked),
      },
      {
        label: this.translate.instant('Samba Authentication'),
        value: this.yesNoPipe.transform(user.smb),
      },
      {
        label: 'SSH',
        value: this.getSshStatus(user),
      },
      {
        label: this.translate.instant('Password History'),
        value: user.password_history?.length >= 0
          ? this.translate.instant('{n, plural, =0 {No History} one {# entry} other {# entries}}', {
            n: user.password_history.length,
          })
          : '–',
      },
      {
        label: this.translate.instant('Password Age'),
        value: !user.password_age && user.password_age !== 0
          ? '–'
          : this.translate.instant('{n, plural, =0 {Less than a day} one {# day} other {# days} }', {
            n: user.password_age,
          }),
      },
      {
        label: this.translate.instant('Last Password Change'),
        value: user.last_password_change?.$date
          ? this.formatDateTime.transform(user.last_password_change.$date)
          : '–',
      },
      {
        label: this.translate.instant('Password Change Required'),
        value: this.yesNoPipe.transform(user.password_change_required),
      },
    ];

    if (user.sudo_commands?.length > 0) {
      details.push({
        label: this.translate.instant('Allowed Sudo Commands'),
        value: user.sudo_commands.join(', '),
      });
    }

    if (user.sudo_commands_nopasswd?.length > 0) {
      details.push({
        label: this.translate.instant('Allowed Sudo Commands (No Password)'),
        value: user.sudo_commands_nopasswd.join(', '),
      });
    }

    return details;
  }

  doEdit(user: User): void {
    this.slideIn.open(OldUserFormComponent, { wide: true, data: user });
  }

  doDelete(user: User): void {
    this.matDialog.open(OldDeleteUserDialog, {
      data: user,
    })
      .afterClosed()
      .pipe(untilDestroyed(this))
      .subscribe((wasDeleted) => {
        if (!wasDeleted) {
          return;
        }

        this.delete.emit(user.id);
      });
  }

  viewLogs(user: User): void {
    const url = this.urlOptions.buildUrl('/system/audit', {
      searchQuery: {
        isBasicQuery: false,
        filters: [['username', '=', user.username]],
      },
    });
    this.router.navigateByUrl(url);
  }

  generateOneTimePassword(user: User): void {
    this.dialogService.confirm({
      title: this.translate.instant('Generate One-Time Password'),
      message: this.translate.instant(
        'Are you sure you want to generate a one-time password for "{username}" user?',
        { username: user.username },
      ),
      hideCheckbox: true,
    }).pipe(
      filter(Boolean),
      switchMap(() => {
        return this.api.call('auth.generate_onetime_password', [{ username: user.username }]).pipe(
          switchMap((password) => {
            this.matDialog.open(OneTimePasswordCreatedDialog, { data: password });
            return of(password);
          }),
          this.loader.withLoader(),
        );
      }),
      this.errorHandler.withErrorHandler(),
      untilDestroyed(this),
    )
      .subscribe();
  }

  private viewUserApiKeys(user: User): void {
    this.router.navigate(['/credentials/users/api-keys'], {
      queryParams: { userName: user.username },
    });
  }

  private getSshStatus(user: User): string {
    const keySet = this.translate.instant('Key set');
    const passwordLoginEnabled = this.translate.instant('Password login enabled');

    if (user.sshpubkey && user.ssh_password_enabled) {
      return `${keySet}, ${passwordLoginEnabled}`;
    }
    if (user.sshpubkey) {
      return keySet;
    }
    if (user.ssh_password_enabled) {
      return passwordLoginEnabled;
    }

    return this.translate.instant('Key not set');
  }
}
