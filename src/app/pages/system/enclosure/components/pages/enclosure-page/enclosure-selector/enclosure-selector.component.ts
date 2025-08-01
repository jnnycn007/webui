import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { EnclosureSideComponent } from 'app/pages/system/enclosure/components/enclosure-side/enclosure-side.component';
import { EnclosureStore } from 'app/pages/system/enclosure/services/enclosure.store';
import { diskStatusTint } from 'app/pages/system/enclosure/utils/disk-status-tint.utils';

@Component({
  selector: 'ix-enclosure-selector',
  templateUrl: './enclosure-selector.component.html',
  styleUrl: './enclosure-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TestDirective,
    RouterLink,
    EnclosureSideComponent,
  ],
})
export class EnclosureSelectorComponent {
  private store = inject(EnclosureStore);

  readonly enclosures = this.store.enclosures;

  readonly selectedEnclosure = computed(() => this.store.selectedEnclosure()?.id);

  readonly diskStatusTint = diskStatusTint;
}
