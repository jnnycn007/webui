import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { helptextInterfaces } from 'app/helptext/network/interfaces/interfaces-list';
import { helptextTopbar } from 'app/helptext/topbar';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { AppState } from 'app/store';
import { checkinIndicatorPressed } from 'app/store/network-interfaces/network-interfaces.actions';
import {
  selectHasPendingNetworkChanges,
  selectNetworkInterfacesCheckinWaiting,
} from 'app/store/network-interfaces/network-interfaces.selectors';

@UntilDestroy()
@Component({
  selector: 'ix-checkin-indicator',
  templateUrl: './checkin-indicator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconButton,
    MatTooltip,
    IxIconComponent,
    AsyncPipe,
    TranslateModule,
    TestDirective,
  ],
})
export class CheckinIndicatorComponent implements OnInit {
  private store$ = inject<Store<AppState>>(Store);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  protected hasPendingNetworkChanges$ = this.store$.select(selectHasPendingNetworkChanges);

  protected readonly tooltips = helptextTopbar.tooltips;

  private isWaitingForCheckin = false;

  ngOnInit(): void {
    this.listenToCheckinStatus();
  }

  showNetworkChangesDialog(): void {
    if (this.isWaitingForCheckin) {
      this.showCheckinWaitingDialog();
    } else {
      this.showPendingNetworkChangesDialog();
    }
  }

  private listenToCheckinStatus(): void {
    this.store$.select(selectNetworkInterfacesCheckinWaiting)
      .pipe(untilDestroyed(this))
      .subscribe((checkinWaiting) => {
        this.isWaitingForCheckin = Boolean(checkinWaiting);
      });
  }

  private showCheckinWaitingDialog(): void {
    this.store$.dispatch(checkinIndicatorPressed());
  }

  private showPendingNetworkChangesDialog(): void {
    this.dialogService.confirm({
      title: this.translate.instant(helptextInterfaces.pendingChangesTitle),
      message: this.translate.instant(helptextInterfaces.pendingChangesMessage),
      hideCheckbox: true,
      buttonText: this.translate.instant('Continue'),
    }).pipe(filter(Boolean), untilDestroyed(this)).subscribe(() => {
      this.router.navigate(['/system/network']);
    });
  }
}
