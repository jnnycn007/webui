import { ChangeDetectionStrategy, Component, input, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { WithLoadingStateDirective } from 'app/modules/loader/directives/with-loading-state/with-loading-state.directive';
import { WidgetResourcesService } from 'app/pages/dashboard/services/widget-resources.service';
import { WidgetComponent } from 'app/pages/dashboard/types/widget-component.interface';
import {
  SlotSize,
} from 'app/pages/dashboard/types/widget.interface';
import { WidgetDatapointComponent } from 'app/pages/dashboard/widgets/common/widget-datapoint/widget-datapoint.component';
import {
  hostnamePassiveWidget,
} from 'app/pages/dashboard/widgets/system/widget-hostname-passive/widget-hostname-passive.definition';

@Component({
  selector: 'ix-widget-hostname-passive',
  templateUrl: './widget-hostname-passive.component.html',
  styleUrls: ['./widget-hostname-passive.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    WithLoadingStateDirective,
    WidgetDatapointComponent,
    TranslateModule,
  ],
})
export class WidgetHostnamePassiveComponent implements WidgetComponent {
  private resources = inject(WidgetResourcesService);

  size = input.required<SlotSize>();
  readonly name = hostnamePassiveWidget.name;

  systemInfo$ = this.resources.dashboardSystemInfo$;
}
