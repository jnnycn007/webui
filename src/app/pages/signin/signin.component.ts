import { AsyncPipe } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatProgressBar } from '@angular/material/progress-bar';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { combineLatest, Observable, of } from 'rxjs';
import {
  delay,
  filter, map, switchMap, take, pairwise,
} from 'rxjs/operators';
import { WINDOW } from 'app/helpers/window.helper';
import { AuthService } from 'app/modules/auth/auth.service';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { CopyrightLineComponent } from 'app/modules/layout/copyright-line/copyright-line.component';
import { TranslatedString } from 'app/modules/translate/translate.helper';
import { DisconnectedMessageComponent } from 'app/pages/signin/disconnected-message/disconnected-message.component';
import { SetAdminPasswordFormComponent } from 'app/pages/signin/set-admin-password-form/set-admin-password-form.component';
import { SigninFormComponent } from 'app/pages/signin/signin-form/signin-form.component';
import { SigninStore } from 'app/pages/signin/store/signin.store';
import { TrueCommandStatusComponent } from 'app/pages/signin/true-command-status/true-command-status.component';
import { TokenLastUsedService } from 'app/services/token-last-used.service';
import { WebSocketStatusService } from 'app/services/websocket-status.service';

@UntilDestroy()
@Component({
  selector: 'ix-signin',
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatProgressBar,
    MatCard,
    MatCardContent,
    IxIconComponent,
    SigninFormComponent,
    SetAdminPasswordFormComponent,
    TrueCommandStatusComponent,
    DisconnectedMessageComponent,
    AsyncPipe,
    TranslateModule,
    CopyrightLineComponent,
  ],
  providers: [SigninStore],
})
export class SigninComponent implements OnInit {
  private wsStatus = inject(WebSocketStatusService);
  private signinStore = inject(SigninStore);
  private dialog = inject(DialogService);
  private authService = inject(AuthService);
  private tokenLastUsedService = inject(TokenLastUsedService);
  private window = inject<Window>(WINDOW);

  protected hasAuthToken = this.authService.hasAuthToken;
  protected isTokenWithinTimeline$ = this.tokenLastUsedService.isTokenWithinTimeline$;

  readonly wasAdminSet$ = this.signinStore.wasAdminSet$;
  readonly canLogin$ = this.signinStore.canLogin$;
  readonly isConnected$ = this.wsStatus.isConnected$;
  isConnectedDelayed$: Observable<boolean> = of(null).pipe(
    delay(1000),
    switchMap(() => this.isConnected$),
  );

  readonly hasLoadingIndicator$ = combineLatest([
    this.signinStore.isLoading$,
    this.isConnected$,
    this.isTokenWithinTimeline$,
  ]).pipe(
    map(([isLoading, isConnected, isTokenWithinTimeline]) => {
      return isLoading || !isConnected || (isTokenWithinTimeline && this.hasAuthToken);
    }),
  );

  constructor() {
    this.wsStatus.isFailoverRestart$
      .pipe(
        filter(Boolean),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.signinStore.init();
        this.wsStatus.setFailoverStatus(false);
      });

    this.signinStore.loginBanner$.pipe(
      filter(Boolean),
      filter(() => this.window.sessionStorage.getItem('loginBannerDismissed') !== 'true'),
      switchMap((text) => {
        return this.dialog.fullScreenDialog({
          message: text as TranslatedString,
          showClose: true,
          pre: true,
        }).pipe(take(1));
      }),
      filter(Boolean),
      untilDestroyed(this),
    ).subscribe(() => {
      this.focusFirstInput();
    });

    this.hasLoadingIndicator$
      .pipe(
        delay(0),
        pairwise(),
        filter(([prev, curr]) => prev && !curr),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.focusFirstInput();
      });
  }

  ngOnInit(): void {
    this.isConnected$
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe(() => {
        this.signinStore.init();
      });
  }

  private focusFirstInput(): void {
    if (this.window.document.querySelector('ix-full-screen-dialog')) {
      return;
    }

    this.window.document.querySelector<HTMLElement>('input')?.focus();
  }
}
