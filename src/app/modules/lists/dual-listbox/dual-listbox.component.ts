import { NgClass, NgStyle } from '@angular/common';
import { Component, ChangeDetectionStrategy, input, IterableDiffers, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { AngularDualListBoxModule, DualListComponent } from 'angular-dual-listbox';
import { MarkedIcon } from 'app/modules/ix-icon/icon-marker.util';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { DetectBrowserService } from 'app/services/detect-browser.service';

@Component({
  selector: 'ix-dual-listbox',
  templateUrl: './dual-listbox.component.html',
  styleUrls: ['./dual-listbox.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass,
    NgStyle,
    AngularDualListBoxModule,
    IxIconComponent,
    MatIconButton,
    TestDirective,
    MatTooltip,
    MatListModule,
    TranslateModule,
  ],
})
export class DualListBoxComponent extends DualListComponent {
  private detectBrowser = inject(DetectBrowserService);

  sourceName = input.required<string>();
  targetName = input.required<string>();
  listItemIcon = input<MarkedIcon | null>(null);

  protected isMacOs = this.detectBrowser.isMacOs();

  constructor() {
    const differs = inject(IterableDiffers);

    super(differs);
  }

  moveAll(): void {
    this.selectAll(this.available);
    this.moveItem(this.available, this.confirmed);
  }

  removeAll(): void {
    this.selectAll(this.confirmed);
    this.moveItem(this.confirmed, this.available);
  }
}
