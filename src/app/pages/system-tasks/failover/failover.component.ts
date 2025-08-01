import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { AlertSlice } from 'app/modules/alerts/store/alert.selectors';
import { AuthService } from 'app/modules/auth/auth.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { CopyrightLineComponent } from 'app/modules/layout/copyright-line/copyright-line.component';
import { LoaderService } from 'app/modules/loader/loader.service';
import { ApiService } from 'app/modules/websocket/api.service';
import { WebSocketHandlerService } from 'app/modules/websocket/websocket-handler.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { WebSocketStatusService } from 'app/services/websocket-status.service';
import { passiveNodeReplaced } from 'app/store/system-info/system-info.actions';

@UntilDestroy()
@Component({
  selector: 'ix-failover',
  templateUrl: './failover.component.html',
  styleUrls: ['./failover.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatCardContent,
    IxIconComponent,
    CopyrightLineComponent,
    TranslateModule,
  ],
})
export class FailoverComponent implements OnInit {
  protected api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private wsManager = inject(WebSocketHandlerService);
  private wsStatus = inject(WebSocketStatusService);
  protected router = inject(Router);
  protected loader = inject(LoaderService);
  protected matDialog = inject(MatDialog);
  private location = inject(Location);
  private store$ = inject<Store<AlertSlice>>(Store);
  private authService = inject(AuthService);


  isWsConnected(): void {
    this.wsStatus.isConnected$.pipe(untilDestroyed(this)).subscribe({
      next: (isConnected) => {
        if (isConnected) {
          this.loader.close();
          // ws is connected
          this.authService.clearAuthToken();
          this.router.navigate(['/signin']);
        } else {
          setTimeout(() => {
            this.isWsConnected();
          }, 5000);
        }
      },
    });
  }

  ngOnInit(): void {
    // Replace URL so that we don't restart again if page is refreshed.
    this.location.replaceState('/signin');
    this.wsStatus.setReconnectAllowed(false);
    this.wsStatus.setFailoverStatus(true);

    this.matDialog.closeAll();
    this.api.call('failover.become_passive').pipe(untilDestroyed(this)).subscribe({
      error: (error: unknown) => { // error on restart
        this.errorHandler.showErrorModal(error)
          .pipe(untilDestroyed(this))
          .subscribe(() => {
            this.router.navigate(['/signin']);
          });
      },
      complete: () => { // show restart screen
        this.store$.dispatch(passiveNodeReplaced());

        this.wsManager.prepareShutdown();
        this.loader.open();
        setTimeout(() => {
          this.isWsConnected();
        }, 1000);
      },
    });
  }
}
