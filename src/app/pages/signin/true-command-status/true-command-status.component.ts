import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { ApiService } from 'app/modules/websocket/api.service';

@UntilDestroy()
@Component({
  selector: 'ix-true-command-status',
  templateUrl: './true-command-status.component.html',
  styleUrls: ['./true-command-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    AsyncPipe,
    IxIconComponent,
  ],
})
export class TrueCommandStatusComponent {
  private api = inject(ApiService);

  protected isManagedByTruecommand$ = this.api.call('truenas.managed_by_truecommand');
}
