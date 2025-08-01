import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from 'app/modules/auth/auth.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { CopyrightLineComponent } from 'app/modules/layout/copyright-line/copyright-line.component';
import { ApiService } from 'app/modules/websocket/api.service';
import { WebSocketHandlerService } from 'app/modules/websocket/websocket-handler.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-shutdown',
  templateUrl: './shutdown.component.html',
  styleUrls: ['./shutdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatCardContent,
    IxIconComponent,
    CopyrightLineComponent,
    TranslateModule,
  ],
})
export class ShutdownComponent implements OnInit {
  protected api = inject(ApiService);
  private wsManager = inject(WebSocketHandlerService);
  private errorHandler = inject(ErrorHandlerService);
  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private authService = inject(AuthService);


  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason') || 'Unknown Reason';

    // Replace URL so that we don't shutdown again if page is refreshed.
    this.location.replaceState('/signin');

    this.api.job('system.shutdown', [reason]).pipe(untilDestroyed(this)).subscribe({
      error: (error: unknown) => { // error on shutdown
        this.errorHandler.showErrorModal(error)
          .pipe(untilDestroyed(this))
          .subscribe(() => {
            this.router.navigate(['/signin']);
          });
      },
      complete: () => {
        this.wsManager.prepareShutdown();
        this.authService.clearAuthToken();
      },
    });
    // fade to black after 60 sec on shut down
    setTimeout(() => {
      const overlay = document.getElementById('overlay');
      overlay?.setAttribute('class', 'blackout');
    }, 60000);
  }
}
