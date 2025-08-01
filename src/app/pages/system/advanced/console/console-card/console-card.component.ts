import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatList, MatListItem } from '@angular/material/list';
import { MatToolbarRow } from '@angular/material/toolbar';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { isEqual } from 'lodash-es';
import {
  Subject, distinctUntilChanged, filter, map, shareReplay, startWith, switchMap, tap,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { Role } from 'app/enums/role.enum';
import { toLoadingState } from 'app/helpers/operators/to-loading-state.helper';
import { WithLoadingStateDirective } from 'app/modules/loader/directives/with-loading-state/with-loading-state.directive';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { consoleCardElements } from 'app/pages/system/advanced/console/console-card/console-card.elements';
import { ConsoleFormComponent } from 'app/pages/system/advanced/console/console-form/console-form.component';
import { FirstTimeWarningService } from 'app/services/first-time-warning.service';
import { AppState } from 'app/store';
import { waitForAdvancedConfig } from 'app/store/system-config/system-config.selectors';

export interface ConsoleConfig {
  consolemenu: boolean;
  serialconsole: boolean;
  serialport: string;
  serialspeed: string;
  motd: string;
}

@UntilDestroy(this)
@Component({
  selector: 'ix-console-card',
  styleUrls: ['../../../general-settings/common-settings-card.scss'],
  templateUrl: './console-card.component.html',
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
export class ConsoleCardComponent {
  private store$ = inject<Store<AppState>>(Store);
  private slideIn = inject(SlideIn);
  private firstTimeWarning = inject(FirstTimeWarningService);

  private readonly reloadConfig$ = new Subject<void>();
  protected readonly requiredRoles = [Role.SystemAdvancedWrite];
  private consoleConfig: ConsoleConfig;
  protected readonly searchableElements = consoleCardElements;
  readonly advancedConfig$ = this.reloadConfig$.pipe(
    startWith(undefined),
    switchMap(() => this.store$),
    waitForAdvancedConfig,
    distinctUntilChanged((previous, current) => {
      const prevConfig: ConsoleConfig = {
        consolemenu: previous.consolemenu,
        serialconsole: previous.serialconsole,
        serialport: previous.serialport,
        serialspeed: previous.serialspeed,
        motd: previous.motd,
      };
      const currentConfig: ConsoleConfig = {
        consolemenu: current.consolemenu,
        serialconsole: current.serialconsole,
        serialport: current.serialport,
        serialspeed: current.serialspeed,
        motd: current.motd,
      };
      return isEqual(prevConfig, currentConfig);
    }),
    map((config) => ({
      consolemenu: config.consolemenu,
      serialconsole: config.serialconsole,
      serialport: config.serialport,
      serialspeed: config.serialspeed,
      motd: config.motd,
    })),
    tap((consoleConfig) => {
      this.consoleConfig = consoleConfig;
    }),
    toLoadingState(),
    shareReplay({
      refCount: false,
      bufferSize: 1,
    }),
  );

  onConfigurePressed(): void {
    this.firstTimeWarning.showFirstTimeWarningIfNeeded().pipe(
      switchMap(() => this.slideIn.open(ConsoleFormComponent, { data: this.consoleConfig })),
      filter((response) => !!response.response),
      tap(() => this.reloadConfig$.next()),
      untilDestroyed(this),
    ).subscribe();
  }
}
