import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatToolbarRow } from '@angular/material/toolbar';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { filter, of } from 'rxjs';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { WINDOW } from 'app/helpers/window.helper';
import { Ipmi } from 'app/interfaces/ipmi.interface';
import { EmptyService } from 'app/modules/empty/empty.service';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { AsyncDataProvider } from 'app/modules/ix-table/classes/async-data-provider/async-data-provider';
import { IxTableComponent } from 'app/modules/ix-table/components/ix-table/ix-table.component';
import { actionsColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-actions/ix-cell-actions.component';
import { textColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-text/ix-cell-text.component';
import { IxTableBodyComponent } from 'app/modules/ix-table/components/ix-table-body/ix-table-body.component';
import { IxTableEmptyDirective } from 'app/modules/ix-table/directives/ix-table-empty.directive';
import { createTable } from 'app/modules/ix-table/utils';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ipmiCardElements } from 'app/pages/system/network/components/ipmi-card/ipmi-card.elements';
import {
  IpmiEventsDialog,
} from 'app/pages/system/network/components/ipmi-card/ipmi-events-dialog/ipmi-events-dialog.component';
import { IpmiFormComponent } from 'app/pages/system/network/components/ipmi-card/ipmi-form/ipmi-form.component';

@UntilDestroy()
@Component({
  selector: 'ix-ipmi-card',
  templateUrl: './ipmi-card.component.html',
  styleUrls: ['./ipmi-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    UiSearchDirective,
    MatToolbarRow,
    MatButton,
    TestDirective,
    IxTableComponent,
    IxTableEmptyDirective,
    IxTableBodyComponent,
    TranslateModule,
    AsyncPipe,
  ],
})
export class IpmiCardComponent implements OnInit {
  private api = inject(ApiService);
  private slideIn = inject(SlideIn);
  private matDialog = inject(MatDialog);
  private translate = inject(TranslateService);
  protected emptyService = inject(EmptyService);
  private window = inject<Window>(WINDOW);

  protected readonly searchableElements = ipmiCardElements.elements;
  protected dataProvider: AsyncDataProvider<Ipmi>;
  columns = createTable<Ipmi>([
    textColumn({
      getValue: (row) => this.translate.instant('Channel {n}', { n: row.channel }),
    }),
    actionsColumn({
      actions: [
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (row) => this.onEdit(row),
        },
        {
          hidden: (row) => of(!this.canOpen(row)),
          iconName: iconMarker('launch'),
          tooltip: this.translate.instant('Open'),
          onClick: (row) => this.onOpen(row),
        },
      ],
    }),
  ], {
    uniqueRowTag: (row) => `ipmi-${row.channel}-${row.ip_address}`,
    ariaLabels: (row) => [row.ip_address, this.translate.instant('IPMI')],
  });

  protected readonly hasIpmi$ = this.api.call('ipmi.is_loaded');

  ngOnInit(): void {
    const ipmi$ = this.api.call('ipmi.lan.query').pipe(untilDestroyed(this));
    this.dataProvider = new AsyncDataProvider<Ipmi>(ipmi$);
    this.loadIpmiEntries();
  }

  private canOpen(ipmi: Ipmi): boolean {
    return ipmi.ip_address !== '0.0.0.0';
  }

  onEdit(ipmi: Ipmi): void {
    this.slideIn.open(IpmiFormComponent, { data: ipmi.id })
      .pipe(
        filter((response) => !!response.response),
        untilDestroyed(this),
      ).subscribe(() => this.loadIpmiEntries());
  }

  private onOpen(ipmi: Ipmi): void {
    this.window.open(`https://${ipmi.ip_address}`);
  }

  onOpenEvents(): void {
    this.matDialog.open(IpmiEventsDialog);
  }

  private loadIpmiEntries(): void {
    this.dataProvider.load();
  }
}
