import { ChangeDetectionStrategy, Component, computed, input, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { EnclosureElementType, enclosureElementTypeLabels } from 'app/enums/enclosure-slot-status.enum';
import { DashboardEnclosure } from 'app/interfaces/enclosure.interface';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { TestDirective } from 'app/modules/test-id/test.directive';

export interface ViewOption {
  url: string[];
  label: string;
}

@Component({
  selector: 'ix-view-elements-menu',
  templateUrl: './view-elements-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    TestDirective,
    MatMenuTrigger,
    IxIconComponent,
    MatMenu,
    MatMenuItem,
    TranslateModule,
  ],
})
export class ViewElementsMenuComponent {
  private router = inject(Router);

  readonly enclosure = input.required<DashboardEnclosure>();

  readonly views = computed<ViewOption[]>(() => {
    const enclosure = this.enclosure();

    return Object.keys(enclosure.elements)
      .map((view: EnclosureElementType) => {
        let url = ['/system/viewenclosure', String(enclosure.id)];

        if (view !== EnclosureElementType.ArrayDeviceSlot) {
          url = [...url, view];
        }

        return {
          url,
          label: enclosureElementTypeLabels.has(view) ? enclosureElementTypeLabels.get(view) : view,
        };
      });
  });

  protected changeView(option: ViewOption): void {
    this.router.navigate(option.url);
  }
}
