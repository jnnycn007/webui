import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatList, MatListItem } from '@angular/material/list';
import { MatToolbarRow } from '@angular/material/toolbar';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import {
  Subject, filter, shareReplay, startWith, switchMap,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { passwordComplexityRulesetLabels } from 'app/enums/password-complexity-ruleset.enum';
import { Role } from 'app/enums/role.enum';
import { toLoadingState } from 'app/helpers/operators/to-loading-state.helper';
import { SystemSecurityConfig } from 'app/interfaces/system-security-config.interface';
import { WithLoadingStateDirective } from 'app/modules/loader/directives/with-loading-state/with-loading-state.directive';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { SystemSecurityFormComponent } from 'app/pages/system/advanced/system-security/system-security-form/system-security-form.component';

@UntilDestroy()
@Component({
  selector: 'ix-system-security-card',
  styleUrls: ['../../../general-settings/common-settings-card.scss'],
  templateUrl: './system-security-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatToolbarRow,
    WithLoadingStateDirective,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    MatCardContent,
    MatList,
    MatListItem,
    TranslateModule,
  ],
})
export class SystemSecurityCardComponent {
  private slideIn = inject(SlideIn);
  private api = inject(ApiService);

  private readonly reloadConfig$ = new Subject<void>();
  protected readonly requiredRoles = [Role.SystemSecurityWrite];
  readonly systemSecurityConfig$ = this.reloadConfig$.pipe(
    startWith(undefined),
    switchMap(() => this.api.call('system.security.config').pipe(toLoadingState())),
    shareReplay({
      refCount: false,
      bufferSize: 1,
    }),
  );

  protected readonly rulesetLabels = passwordComplexityRulesetLabels;

  openSystemSecuritySettings(config: SystemSecurityConfig): void {
    this.slideIn.open(SystemSecurityFormComponent, { data: config }).pipe(
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe(() => {
      this.reloadConfig$.next();
    });
  }
}
