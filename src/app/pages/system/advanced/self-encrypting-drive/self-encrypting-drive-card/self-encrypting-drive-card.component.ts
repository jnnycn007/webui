import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatList, MatListItem } from '@angular/material/list';
import { MatToolbarRow } from '@angular/material/toolbar';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { isEqual } from 'lodash-es';
import { Subject, combineLatest } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map, shareReplay, startWith, switchMap, tap,
} from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { Role } from 'app/enums/role.enum';
import { toLoadingState } from 'app/helpers/operators/to-loading-state.helper';
import { WithLoadingStateDirective } from 'app/modules/loader/directives/with-loading-state/with-loading-state.directive';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { sedCardElements } from 'app/pages/system/advanced/self-encrypting-drive/self-encrypting-drive-card/self-encrypting-drive-card.elements';
import { SelfEncryptingDriveFormComponent } from 'app/pages/system/advanced/self-encrypting-drive/self-encrypting-drive-form/self-encrypting-drive-form.component';
import { FirstTimeWarningService } from 'app/services/first-time-warning.service';
import { AppState } from 'app/store';
import { waitForAdvancedConfig } from 'app/store/system-config/system-config.selectors';

@UntilDestroy()
@Component({
  selector: 'ix-self-encrypting-drive-card',
  styleUrls: ['../../../general-settings/common-settings-card.scss'],
  templateUrl: './self-encrypting-drive-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    UiSearchDirective,
    MatToolbarRow,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    MatCardContent,
    MatList,
    MatListItem,
    WithLoadingStateDirective,
    TranslateModule,
  ],
})
export class SelfEncryptingDriveCardComponent {
  private store$ = inject<Store<AppState>>(Store);
  private api = inject(ApiService);
  private slideIn = inject(SlideIn);
  private firstTimeWarning = inject(FirstTimeWarningService);

  private readonly reloadConfig$ = new Subject<void>();
  protected readonly searchableElements = sedCardElements;
  protected readonly requiredRoles = [Role.SystemAdvancedWrite];

  readonly sedConfig$ = this.reloadConfig$.pipe(
    startWith(undefined),
    switchMap(() => {
      const updatedSedUser$ = this.store$.pipe(
        waitForAdvancedConfig,
        distinctUntilChanged((previous, current) => isEqual(previous.sed_user, current.sed_user)),
        map((config) => config.sed_user),
      );
      const updatedSedPassword$ = this.api.call('system.advanced.sed_global_password').pipe(
        map((sedPassword) => '*'.repeat(sedPassword.length) || '–'),
      );
      return combineLatest([
        updatedSedUser$,
        updatedSedPassword$,
      ]);
    }),
    map(([sedUser, sedPassword]) => ({ sedUser, sedPassword })),
    toLoadingState(),
    shareReplay({
      refCount: false,
      bufferSize: 1,
    }),
  );

  onConfigure(): void {
    this.firstTimeWarning.showFirstTimeWarningIfNeeded().pipe(
      switchMap(() => this.slideIn.open(
        SelfEncryptingDriveFormComponent,
        { data: { sedPassword: '' } },
      )),
      filter((response) => !!response.response),
      tap(() => this.reloadConfig$.next()),
      untilDestroyed(this),
    ).subscribe();
  }
}
