import { ChangeDetectionStrategy, Component, input, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardEnclosure } from 'app/interfaces/enclosure.interface';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { EnclosureStore } from 'app/pages/system/enclosure/services/enclosure.store';
import { EnclosureSide } from 'app/pages/system/enclosure/utils/supported-enclosures';

@Component({
  selector: 'ix-enclosure-side-switch',
  templateUrl: './enclosure-side-switch.component.html',
  styleUrl: './enclosure-side-switch.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class EnclosureSideSwitchComponent {
  private store = inject(EnclosureStore);

  readonly enclosure = input.required<DashboardEnclosure>();

  protected readonly hasMoreThanOneSide = this.store.hasMoreThanOneSide;
  protected readonly EnclosureSide = EnclosureSide;

  protected onSideChange(side: EnclosureSide): void {
    this.store.selectSide(side);
  }
}
