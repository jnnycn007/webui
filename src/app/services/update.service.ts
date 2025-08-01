import { Injectable, inject } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WINDOW } from 'app/helpers/window.helper';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { GlobalApiHttpService } from 'app/services/global-api-http.service';

@Injectable({
  providedIn: 'root',
})
export class UpdateService {
  private globalApi = inject(GlobalApiHttpService);
  private errorHandler = inject(ErrorHandlerService);
  private window = inject<Window>(WINDOW);

  private lastSeenBootId: string;

  /**
   * Hard refresh is needed to load new html and js after the update.
   */
  hardRefreshIfNeeded(): Observable<string> {
    return this.globalApi.getBootId().pipe(
      tap((bootId) => {
        if (!this.lastSeenBootId) {
          this.lastSeenBootId = bootId;
          return;
        }

        if (this.lastSeenBootId !== bootId) {
          this.window.location.reload();
        }
      }),
      catchError((error: unknown) => {
        // Critical path, silence errors to avoid UI reboot loop and hope for the best.
        this.errorHandler.handleError(error);

        return of('');
      }),
    );
  }
}
