import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { switchMap } from 'rxjs';
import { filter } from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { InitShutdownScriptType, initShutdownScriptTypeLabels } from 'app/enums/init-shutdown-script-type.enum';
import { initShutdownScriptWhenLabels } from 'app/enums/init-shutdown-script-when.enum';
import { Role } from 'app/enums/role.enum';
import { InitShutdownScript } from 'app/interfaces/init-shutdown-script.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { EmptyService } from 'app/modules/empty/empty.service';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { AsyncDataProvider } from 'app/modules/ix-table/classes/async-data-provider/async-data-provider';
import { IxTableComponent } from 'app/modules/ix-table/components/ix-table/ix-table.component';
import {
  actionsColumn,
} from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-actions/ix-cell-actions.component';
import { textColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-text/ix-cell-text.component';
import {
  yesNoColumn,
} from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-yes-no/ix-cell-yes-no.component';
import { IxTableBodyComponent } from 'app/modules/ix-table/components/ix-table-body/ix-table-body.component';
import { IxTableHeadComponent } from 'app/modules/ix-table/components/ix-table-head/ix-table-head.component';
import { IxTablePagerComponent } from 'app/modules/ix-table/components/ix-table-pager/ix-table-pager.component';
import { IxTableEmptyDirective } from 'app/modules/ix-table/directives/ix-table-empty.directive';
import { createTable } from 'app/modules/ix-table/utils';
import { LoaderService } from 'app/modules/loader/loader.service';
import { PageHeaderComponent } from 'app/modules/page-header/page-title-header/page-header.component';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import {
  InitShutdownFormComponent,
} from 'app/pages/system/advanced/init-shutdown/init-shutdown-form/init-shutdown-form.component';
import { initShudownListElements } from 'app/pages/system/advanced/init-shutdown/init-shutdown-list/init-shutdown-list.elements';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-init-shutdown-list',
  templateUrl: './init-shutdown-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    UiSearchDirective,
    IxTableComponent,
    IxTableEmptyDirective,
    IxTableHeadComponent,
    IxTableBodyComponent,
    IxTablePagerComponent,
    TranslateModule,
    AsyncPipe,
  ],
})
export class InitShutdownListComponent implements OnInit {
  private translate = inject(TranslateService);
  private slideIn = inject(SlideIn);
  private dialogService = inject(DialogService);
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private loader = inject(LoaderService);
  protected emptyService = inject(EmptyService);

  protected readonly requiredRoles = [Role.SystemCronWrite];
  protected readonly searchableElements = initShudownListElements;

  dataProvider: AsyncDataProvider<InitShutdownScript>;

  columns = createTable<InitShutdownScript>([
    textColumn({
      title: this.translate.instant('Type'),
      propertyName: 'type',
      getValue: (row) => {
        const typeLabel = initShutdownScriptTypeLabels.get(row.type) || row.type;
        return this.translate.instant(typeLabel);
      },
    }),
    textColumn({
      title: this.translate.instant('Description'),
      propertyName: 'comment',
    }),
    textColumn({
      title: this.translate.instant('When'),
      propertyName: 'when',
      getValue: (row) => {
        const whenLabel = initShutdownScriptWhenLabels.get(row.when) || row.when;
        return this.translate.instant(whenLabel);
      },
    }),
    textColumn({
      title: this.translate.instant('Command/Script'),
      propertyName: 'script',
      getValue: (row) => (row.type === InitShutdownScriptType.Command ? row.command : row.script),
    }),
    yesNoColumn({
      title: this.translate.instant('Enabled'),
      propertyName: 'enabled',
    }),
    actionsColumn({
      actions: [
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (row) => this.editScript(row),
        },
        {
          iconName: iconMarker('mdi-delete'),
          tooltip: this.translate.instant('Delete'),
          onClick: (row) => this.deleteScript(row),
          requiredRoles: this.requiredRoles,
        },
      ],
    }),
  ], {
    uniqueRowTag: (row) => 'init-shutdown-' + row.command + '-' + row.type,
    ariaLabels: (row) => [row.command, this.translate.instant('Init/Shutdown Script')],
  });

  ngOnInit(): void {
    this.dataProvider = new AsyncDataProvider(this.api.call('initshutdownscript.query'));
    this.dataProvider.load();
  }

  protected addScript(): void {
    this.slideIn.open(InitShutdownFormComponent)
      .pipe(filter((response) => !!response.response), untilDestroyed(this))
      .subscribe(() => this.dataProvider.load());
  }

  private editScript(script: InitShutdownScript): void {
    this.slideIn.open(InitShutdownFormComponent, { data: script })
      .pipe(filter((response) => !!response.response), untilDestroyed(this))
      .subscribe(() => this.dataProvider.load());
  }

  private deleteScript(script: InitShutdownScript): void {
    this.dialogService.confirm({
      title: this.translate.instant('Confirmation'),
      message: this.translate.instant('Are you sure you want to delete this script?'),
      hideCheckbox: true,
    }).pipe(
      filter(Boolean),
      switchMap(() => {
        return this.api.call('initshutdownscript.delete', [script.id]).pipe(
          this.errorHandler.withErrorHandler(),
          this.loader.withLoader(),
        );
      }),
      untilDestroyed(this),
    ).subscribe(() => this.dataProvider.load());
  }
}
