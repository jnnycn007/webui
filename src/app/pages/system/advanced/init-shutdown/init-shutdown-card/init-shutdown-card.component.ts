import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import { MatToolbarRow } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  switchMap, filter, tap,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { Role } from 'app/enums/role.enum';
import { InitShutdownScript } from 'app/interfaces/init-shutdown-script.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { EmptyService } from 'app/modules/empty/empty.service';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
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
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { initShutdownCardElements } from 'app/pages/system/advanced/init-shutdown/init-shutdown-card/init-shutdown-card.elements';
import {
  InitShutdownFormComponent,
} from 'app/pages/system/advanced/init-shutdown/init-shutdown-form/init-shutdown-form.component';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { FirstTimeWarningService } from 'app/services/first-time-warning.service';

@UntilDestroy()
@Component({
  selector: 'ix-init-shutdown-card',
  templateUrl: './init-shutdown-card.component.html',
  styleUrls: ['./init-shutdown-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatToolbarRow,
    TestDirective,
    RouterLink,
    IxIconComponent,
    RequiresRolesDirective,
    MatButton,
    UiSearchDirective,
    IxTableComponent,
    IxTableEmptyDirective,
    IxTableHeadComponent,
    IxTableBodyComponent,
    TranslateModule,
    AsyncPipe,
  ],
})
export class InitShutdownCardComponent implements OnInit {
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorHandlerService);
  private api = inject(ApiService);
  private dialog = inject(DialogService);
  private snackbar = inject(SnackbarService);
  private firstTimeWarning = inject(FirstTimeWarningService);
  protected emptyService = inject(EmptyService);
  private slideIn = inject(SlideIn);

  protected readonly requiredRoles = [Role.SystemCronWrite];
  protected readonly searchableElements = initShutdownCardElements;

  dataProvider: AsyncDataProvider<InitShutdownScript>;

  columns = createTable<InitShutdownScript>([
    textColumn({
      title: this.translate.instant('Command / Script'),
      propertyName: 'command',
      getValue: (row) => row.script || row.command,
    }),
    textColumn({
      title: this.translate.instant('Description'),
      propertyName: 'comment',
    }),
    textColumn({
      title: this.translate.instant('When'),
      propertyName: 'when',
    }),
    yesNoColumn({
      title: this.translate.instant('Enabled'),
      propertyName: 'enabled',
    }),
    textColumn({
      title: this.translate.instant('Timeout'),
      propertyName: 'timeout',
    }),
    actionsColumn({
      actions: [
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (row) => this.onEdit(row),
        },
        {
          iconName: iconMarker('mdi-delete'),
          tooltip: this.translate.instant('Delete'),
          onClick: (row) => this.onDelete(row),
          requiredRoles: this.requiredRoles,
        },
      ],
    }),
  ], {
    uniqueRowTag: (row) => 'card-init-shutdown-' + row.command + '-' + row.when,
    ariaLabels: (row) => [row.command, this.translate.instant('Init/Shutdown Script')],
  });

  ngOnInit(): void {
    this.loadScripts();
  }

  onAdd(): void {
    this.openForm();
  }

  private loadScripts(): void {
    if (!this.dataProvider) {
      const scripts$ = this.api.call('initshutdownscript.query').pipe(untilDestroyed(this));
      this.dataProvider = new AsyncDataProvider<InitShutdownScript>(scripts$);
    }
    this.dataProvider.load();
  }

  onDelete(row: InitShutdownScript): void {
    this.dialog.confirm({
      title: this.translate.instant('Delete Script'),
      message: this.translate.instant('Delete Init/Shutdown Script {script}?', {
        script: row.command,
      }),
      buttonColor: 'warn',
      buttonText: this.translate.instant('Delete'),
    })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.call('initshutdownscript.delete', [row.id])),
        filter(Boolean),
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.snackbar.success(this.translate.instant('Script deleted.'));
        this.loadScripts();
      });
  }

  onEdit(row: InitShutdownScript): void {
    this.openForm(row);
  }

  private openForm(row?: InitShutdownScript): void {
    this.firstTimeWarning.showFirstTimeWarningIfNeeded().pipe(
      switchMap(() => this.slideIn.open(InitShutdownFormComponent, { data: row })),
      filter((response) => !!response.response),
      tap(() => this.loadScripts()),
      untilDestroyed(this),
    ).subscribe();
  }
}
