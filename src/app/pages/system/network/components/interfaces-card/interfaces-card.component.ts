import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, output, signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import { MatToolbarRow } from '@angular/material/toolbar';
import { MatTooltip } from '@angular/material/tooltip';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import {
  filter, map, throttleTime,
} from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { NetworkInterfaceType } from 'app/enums/network-interface.enum';
import { Role } from 'app/enums/role.enum';
import { helptextInterfaces } from 'app/helptext/network/interfaces/interfaces-list';
import { NetworkInterface } from 'app/interfaces/network-interface.interface';
import { AllNetworkInterfacesUpdate } from 'app/interfaces/reporting.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { InterfaceStatusIconComponent } from 'app/modules/interface-status-icon/interface-status-icon.component';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { ArrayDataProvider } from 'app/modules/ix-table/classes/array-data-provider/array-data-provider';
import { IxTableComponent } from 'app/modules/ix-table/components/ix-table/ix-table.component';
import { actionsWithMenuColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-actions-with-menu/ix-cell-actions-with-menu.component';
import { textColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-text/ix-cell-text.component';
import { IxTableBodyComponent } from 'app/modules/ix-table/components/ix-table-body/ix-table-body.component';
import { IxTableHeadComponent } from 'app/modules/ix-table/components/ix-table-head/ix-table-head.component';
import { IxTableCellDirective } from 'app/modules/ix-table/directives/ix-table-cell.directive';
import { createTable } from 'app/modules/ix-table/utils';
import { LoaderService } from 'app/modules/loader/loader.service';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { InterfaceFormComponent } from 'app/pages/system/network/components/interface-form/interface-form.component';
import { interfacesCardElements } from 'app/pages/system/network/components/interfaces-card/interfaces-card.elements';
import {
  ipAddressesColumn,
} from 'app/pages/system/network/components/interfaces-card/ip-addresses-cell/ip-addresses-cell.component';
import { InterfacesStore } from 'app/pages/system/network/stores/interfaces.store';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { NetworkService } from 'app/services/network.service';
import { AppState } from 'app/store';
import { networkInterfacesChanged } from 'app/store/network-interfaces/network-interfaces.actions';

@UntilDestroy()
@Component({
  selector: 'ix-interfaces-card',
  templateUrl: './interfaces-card.component.html',
  styleUrls: ['./interfaces-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatToolbarRow,
    MatTooltip,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    UiSearchDirective,
    IxTableComponent,
    IxTableHeadComponent,
    AsyncPipe,
    IxTableBodyComponent,
    IxTableCellDirective,
    InterfaceStatusIconComponent,
    TranslateModule,
  ],
})
export class InterfacesCardComponent implements OnInit {
  private interfacesStore$ = inject(InterfacesStore);
  private store$ = inject<Store<AppState>>(Store);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  private slideIn = inject(SlideIn);
  private dialogService = inject(DialogService);
  private api = inject(ApiService);
  private loader = inject(LoaderService);
  private errorHandler = inject(ErrorHandlerService);
  private networkService = inject(NetworkService);

  protected readonly searchableElements = interfacesCardElements.elements;

  readonly interfacesUpdated = output();

  protected readonly requiredRoles = [Role.NetworkInterfaceWrite];
  protected interfaces: NetworkInterface[] = [];

  protected readonly isHaEnabled$ = new BehaviorSubject<boolean>(false);
  private readonly isHaEnabled = toSignal(this.isHaEnabled$);

  isLoading = false;
  dataProvider = new ArrayDataProvider<NetworkInterface>();
  inOutUpdates = signal<AllNetworkInterfacesUpdate>({});

  columns = createTable<NetworkInterface>([
    textColumn({
      propertyName: 'state',
    }),
    textColumn({
      title: this.translate.instant('Name'),
      propertyName: 'name',
      getValue: (row) => {
        const value = row.name;

        if (row.description) {
          return `${value} (${row.description})`;
        }

        return value;
      },
    }),
    ipAddressesColumn({
      title: this.translate.instant('IP Addresses'),
      sortBy: (row) => row.aliases.map((alias) => alias.address).join(', '),
      cssClass: 'wider-column',
    }),
    textColumn({
      title: this.translate.instant('MAC Address'),
      cssClass: 'wider-column',
      getValue: (row) => row.state.permanent_link_address,
    }),
    actionsWithMenuColumn({
      actions: [
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (row) => this.onEdit(row),
        },
        {
          iconName: iconMarker('refresh'),
          requiredRoles: this.requiredRoles,
          hidden: (row) => combineLatest([
            of(!this.isPhysical(row)),
            this.isHaEnabled$,
          ]).pipe(
            map(([isNotPhysical, isHaEnabled]) => isHaEnabled || isNotPhysical),
          ),
          tooltip: this.translate.instant('Reset configuration'),
          onClick: (row) => this.onReset(row),
        },
        {
          iconName: iconMarker(''),
          hidden: () => this.isHaEnabled$.pipe(map((isHaEnabled) => !isHaEnabled)),
          disabled: () => of(true),
          tooltip: this.translate.instant(helptextInterfaces.haEnabledResetMessage),
          onClick: (): void => {},
        },
        {
          iconName: iconMarker('mdi-delete'),
          requiredRoles: this.requiredRoles,
          dynamicTooltip: () => this.isHaEnabled$.pipe(
            map((isHaEnabled) => (isHaEnabled
              ? this.translate.instant(helptextInterfaces.haEnabledDeleteMessage)
              : this.translate.instant('Delete'))),
          ),
          hidden: (row) => of(this.isPhysical(row)),
          onClick: (row) => this.onDelete(row),
          disabled: () => this.isHaEnabled$,
        },
      ],
    }),
  ], {
    uniqueRowTag: (row) => 'interface-' + row.name,
    ariaLabels: (row) => [row.name, this.translate.instant('Interface')],
  });

  readonly helptext = helptextInterfaces;

  private isPhysical(row: NetworkInterface): boolean {
    return row.type === NetworkInterfaceType.Physical;
  }

  ngOnInit(): void {
    this.interfacesStore$.loadInterfaces();
    this.interfacesStore$.state$.pipe(untilDestroyed(this)).subscribe((state) => {
      this.isLoading = state.isLoading;
      this.interfaces = state.interfaces;
      this.dataProvider.setRows(state.interfaces);
      this.inOutUpdates.set({});
      for (const nic of state.interfaces) {
        this.inOutUpdates.update((value) => {
          value[nic.name] = {
            link_state: nic.state?.link_state,
            received_bytes_rate: 0,
            sent_bytes_rate: 0,
            speed: 0,
          };
          return value;
        });
      }
      this.subscribeToUpdates();

      this.cdr.markForCheck();
    });
    this.checkFailoverDisabled();
  }

  private checkFailoverDisabled(): void {
    this.networkService.getIsHaEnabled().pipe(
      untilDestroyed(this),
    ).subscribe((isHaEnabled) => {
      this.isHaEnabled$.next(isHaEnabled);
      this.cdr.markForCheck();
    });
  }

  protected onAddNew(): void {
    this.slideIn.open(InterfaceFormComponent, {
      data: {
        interfaces: this.interfaces,
      },
    })
      .pipe(
        filter((response) => !!response.response),
        untilDestroyed(this),
      ).subscribe(() => {
        this.interfacesUpdated.emit();
        this.interfacesStore$.loadInterfaces();
      });
  }

  protected onEdit(row: NetworkInterface): void {
    this.slideIn.open(InterfaceFormComponent, {
      data: {
        interface: row,
      },
    }).pipe(
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe(() => {
      this.interfacesUpdated.emit();
      this.interfacesStore$.loadInterfaces();
    });
  }

  protected onDelete(row: NetworkInterface): void {
    this.dialogService.confirm({
      title: this.translate.instant('Delete Interface'),
      message: this.translate.instant(helptextInterfaces.deleteDialogText),
      buttonText: this.translate.instant('Delete'),
    })
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe(() => this.makeDeleteCall(row));
  }

  protected onReset(row: NetworkInterface): void {
    this.dialogService.confirm({
      title: this.translate.instant('Reset Configuration'),
      message: this.translate.instant(helptextInterfaces.deleteDialogText),
      buttonText: this.translate.instant('Reset'),
    })
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe(() => this.makeDeleteCall(row));
  }

  private makeDeleteCall(row: NetworkInterface): void {
    this.api.call('interface.delete', [row.id])
      .pipe(
        this.loader.withLoader(),
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.interfacesUpdated.emit();
        this.interfacesStore$.loadInterfaces();
        this.store$.dispatch(networkInterfacesChanged({ commit: false, checkIn: false }));
      });
  }

  private subscribeToUpdates(): void {
    this.networkService.subscribeToInOutUpdates()
      .pipe(
        filter(Boolean),
        throttleTime(1000),
        untilDestroyed(this),
      )
      .subscribe((updates) => {
        const updatedInterfaces = Object.keys(updates);
        this.inOutUpdates.update((value) => {
          for (const nic of updatedInterfaces) {
            value[nic] = { ...updates[nic] };
          }
          return value;
        });
        this.cdr.markForCheck();
      });
  }
}
