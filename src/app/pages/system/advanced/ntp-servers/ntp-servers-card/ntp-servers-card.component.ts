import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import { MatToolbarRow } from '@angular/material/toolbar';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { filter, switchMap } from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { Role } from 'app/enums/role.enum';
import { NtpServer } from 'app/interfaces/ntp-server.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { EmptyService } from 'app/modules/empty/empty.service';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { AsyncDataProvider } from 'app/modules/ix-table/classes/async-data-provider/async-data-provider';
import { IxTableComponent } from 'app/modules/ix-table/components/ix-table/ix-table.component';
import { actionsColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-actions/ix-cell-actions.component';
import { textColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-text/ix-cell-text.component';
import {
  yesNoColumn,
} from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-yes-no/ix-cell-yes-no.component';
import { IxTableBodyComponent } from 'app/modules/ix-table/components/ix-table-body/ix-table-body.component';
import { IxTableHeadComponent } from 'app/modules/ix-table/components/ix-table-head/ix-table-head.component';
import { IxTableEmptyDirective } from 'app/modules/ix-table/directives/ix-table-empty.directive';
import { createTable } from 'app/modules/ix-table/utils';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ntpServersElements } from 'app/pages/system/advanced/ntp-servers/ntp-servers-card/ntp-servers-card.elements';
import { NtpServersFormComponent } from 'app/pages/system/advanced/ntp-servers/ntp-servers-form/ntp-servers-form.component';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-ntp-servers-card',
  templateUrl: './ntp-servers-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    UiSearchDirective,
    MatToolbarRow,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    IxTableComponent,
    IxTableEmptyDirective,
    IxTableHeadComponent,
    IxTableBodyComponent,
    TranslateModule,
    AsyncPipe,
  ],
})
export class NtpServersCardComponent implements OnInit {
  protected emptyService = inject(EmptyService);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorHandlerService);
  private api = inject(ApiService);
  private dialog = inject(DialogService);
  private slideIn = inject(SlideIn);

  protected readonly requiredRoles = [Role.NetworkGeneralWrite];
  protected readonly searchableElements = ntpServersElements;

  dataProvider: AsyncDataProvider<NtpServer>;

  columns = createTable<NtpServer>([
    textColumn({
      title: this.translate.instant('Address'),
      propertyName: 'address',
    }),
    yesNoColumn({
      title: this.translate.instant('Burst'),
      propertyName: 'burst',
    }),
    yesNoColumn({
      title: this.translate.instant('IBurst'),
      propertyName: 'iburst',
    }),
    yesNoColumn({
      title: this.translate.instant('Prefer'),
      propertyName: 'prefer',
    }),
    textColumn({
      title: this.translate.instant('Min Poll'),
      propertyName: 'minpoll',
    }),
    textColumn({
      title: this.translate.instant('Max Poll'),
      propertyName: 'maxpoll',
    }),
    actionsColumn({
      actions: [
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (row) => this.doEdit(row),
          requiredRoles: this.requiredRoles,
        },
        {
          iconName: iconMarker('mdi-delete'),
          tooltip: this.translate.instant('Delete'),
          onClick: (row) => this.doDelete(row),
          requiredRoles: this.requiredRoles,
        },
      ],
    }),
  ], {
    uniqueRowTag: (row) => `ntp-server-${row.address}-${row.minpoll}-${row.maxpoll}`,
    ariaLabels: (row) => [row.address, this.translate.instant('NTP Server')],
  });

  ngOnInit(): void {
    const ntpServers$ = this.api.call('system.ntpserver.query').pipe(untilDestroyed(this));
    this.dataProvider = new AsyncDataProvider<NtpServer>(ntpServers$);
    this.loadItems();
  }

  loadItems(): void {
    this.dataProvider.load();
  }

  doDelete(server: NtpServer): void {
    this.dialog.confirm({
      title: this.translate.instant('Delete NTP Server'),
      message: this.translate.instant(
        'Are you sure you want to delete the <b>{address}</b> NTP Server?',
        { address: server.address },
      ),
      buttonText: this.translate.instant('Delete'),
      buttonColor: 'warn',
    }).pipe(
      filter(Boolean),
      switchMap(() => this.api.call('system.ntpserver.delete', [server.id])),
      this.errorHandler.withErrorHandler(),
      untilDestroyed(this),
    ).subscribe(() => {
      this.loadItems();
    });
  }

  doAdd(): void {
    this.slideIn.open(NtpServersFormComponent).pipe(
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe(() => this.loadItems());
  }

  doEdit(server: NtpServer): void {
    this.slideIn.open(NtpServersFormComponent, { data: server }).pipe(
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe(() => this.loadItems());
  }
}
