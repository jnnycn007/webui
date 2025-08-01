import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { isEqual } from 'lodash';
import { EMPTY } from 'rxjs';
import {
  catchError, filter, map, mergeMap, pairwise, startWith, switchMap, withLatestFrom,
} from 'rxjs/operators';
import { AuthService } from 'app/modules/auth/auth.service';
import { ApiService } from 'app/modules/websocket/api.service';
import { adminUiInitialized } from 'app/store/admin-panel/admin.actions';
import { AppState } from 'app/store/index';
import {
  autoRefreshReportsToggled,
  builtinGroupsToggled,
  builtinUsersToggled, guiFormSubmitted, lifetimeTokenUpdated, localizationFormSubmitted,
  preferencesLoaded, preferredColumnsUpdated,
  shownNewIndicatorKeysUpdated,
  themeNotFound,
  terminalFontSizeUpdated,
  updateRebootAfterManualUpdate,
} from 'app/store/preferences/preferences.actions';
import { waitForPreferences } from 'app/store/preferences/preferences.selectors';
import { sidenavUpdated } from 'app/store/topbar/topbar.actions';
import {
  snapshotExtraColumnsToggled, dashboardStateLoaded, noPreferencesFound, noDashboardStateFound,
} from './preferences.actions';

@Injectable()
export class PreferencesEffects {
  private actions$ = inject(Actions);
  private api = inject(ApiService);
  private store$ = inject<Store<AppState>>(Store);
  private authService = inject(AuthService);

  loadPreferences$ = createEffect(() => this.actions$.pipe(
    ofType(adminUiInitialized),
    mergeMap(() => {
      return this.authService.user$.pipe(
        filter(Boolean),
        map((user) => {
          const preferences = user.attributes?.preferences;
          const dashboardState = user.attributes?.dashState;

          if (dashboardState) {
            this.store$.dispatch(dashboardStateLoaded({ dashboardState }));
          } else {
            this.store$.dispatch(noDashboardStateFound());
          }

          if (!preferences) {
            return noPreferencesFound();
          }

          return preferencesLoaded({ preferences });
        }),
        catchError((error: unknown) => {
          // TODO: Basically a fatal error. Handle it.
          console.error(error);
          return EMPTY;
        }),
      );
    }),
  ));

  saveUpdatedPreferences$ = createEffect(() => this.actions$.pipe(
    ofType(
      sidenavUpdated,
      themeNotFound,
      preferredColumnsUpdated,
      builtinUsersToggled,
      snapshotExtraColumnsToggled,
      shownNewIndicatorKeysUpdated,
      builtinGroupsToggled,
      localizationFormSubmitted,
      lifetimeTokenUpdated,
      terminalFontSizeUpdated,
      guiFormSubmitted,
      updateRebootAfterManualUpdate,
      autoRefreshReportsToggled,
    ),
    withLatestFrom(this.store$.pipe(waitForPreferences, startWith(undefined), pairwise())),
    filter(([, [prevPrefs, newPrefs]]) => !isEqual(prevPrefs, newPrefs)),
    switchMap(([, [, newPrefs]]) => {
      return this.api.call('auth.set_attribute', ['preferences', newPrefs]);
    }),
  ), { dispatch: false });
}
