import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  finalize, map, of, tap,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { choicesToOptions } from 'app/helpers/operators/options.operators';
import { VirtualizationGlobalConfig, VirtualizationGlobalConfigUpdate } from 'app/interfaces/virtualization.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxIpInputWithNetmaskComponent } from 'app/modules/forms/ix-forms/components/ix-ip-input-with-netmask/ix-ip-input-with-netmask.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import {
  IxSlideToggleComponent,
} from 'app/modules/forms/ix-forms/components/ix-slide-toggle/ix-slide-toggle.component';
import {
  ModalHeaderComponent,
} from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-global-config-form',
  templateUrl: './global-config-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormActionsComponent,
    ModalHeaderComponent,
    MatButton,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    RequiresRolesDirective,
    TestDirective,
    TranslateModule,
    IxFieldsetComponent,
    IxSelectComponent,
    IxIpInputWithNetmaskComponent,
    IxSlideToggleComponent,
  ],
})
export class GlobalConfigFormComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private api = inject(ApiService);
  private snackbar = inject(SnackbarService);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);
  private errorHandler = inject(ErrorHandlerService);
  slideInRef = inject<SlideInRef<VirtualizationGlobalConfig, boolean>>(SlideInRef);

  protected readonly requiredRoles = [Role.VirtGlobalWrite];
  protected isLoading = signal(false);
  protected currentConfig = signal<VirtualizationGlobalConfig>(this.slideInRef.getData());
  protected readonly autoBridge = '[AUTO]';

  protected readonly form = this.formBuilder.nonNullable.group({
    pool: [false],
    bridge: [this.autoBridge],
    v4_network: [null as string | null],
    v6_network: [null as string | null],
    storage_pools: [[] as string[] | null],
  });

  protected poolOptions$ = this.api.call('virt.global.pool_choices').pipe(
    choicesToOptions(),
    map((options) => options.slice(1)),
    tap((options) => {
      if (options.length && !this.currentConfig().storage_pools?.length) {
        this.form.patchValue({ storage_pools: [`${options[0].value}`] });
      }
    }),
  );

  protected bridgeOptions$ = this.api.call('virt.global.bridge_choices').pipe(choicesToOptions());

  get isAutoBridge(): boolean {
    return this.form.controls.bridge.value === this.autoBridge;
  }

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });
  }

  ngOnInit(): void {
    const currentConfig = this.currentConfig();
    this.form.setValue({
      pool: Boolean(currentConfig?.storage_pools?.length),
      bridge: !currentConfig.bridge ? this.autoBridge : currentConfig.bridge,
      v4_network: currentConfig.v4_network,
      v6_network: currentConfig.v6_network,
      storage_pools: currentConfig.storage_pools || [],
    });
  }

  onSubmit(): void {
    this.isLoading.set(true);

    const controls = this.form.controls;
    const pools = controls.storage_pools.value;
    const values: VirtualizationGlobalConfigUpdate = {
      pool: controls.pool.value && pools.length ? pools[0] : null,
      bridge: controls.bridge.value,
      v4_network: (!this.isAutoBridge || !controls.v4_network.value) ? null : controls.v4_network.value,
      v6_network: (!this.isAutoBridge || !controls.v6_network.value) ? null : controls.v6_network.value,
      storage_pools: controls.pool.value && pools.length ? pools : [],
    };

    this.dialogService.jobDialog(
      this.api.job('virt.global.update', [values]),
      { title: this.translate.instant('Updating settings') },
    )
      .afterClosed()
      .pipe(
        this.errorHandler.withErrorHandler(),
        finalize(() => this.isLoading.set(false)),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.snackbar.success(this.translate.instant('Virtualization settings updated'));
        this.slideInRef.close({
          response: true,
        });
      });
  }
}
