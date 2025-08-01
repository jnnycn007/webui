import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatStepperPrevious, MatStepperNext } from '@angular/material/stepper';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { VmNicType, vmNicTypeLabels } from 'app/enums/vm.enum';
import { choicesToOptions } from 'app/helpers/operators/options.operators';
import { mapToOptions } from 'app/helpers/options.helper';
import { helptextVmWizard } from 'app/helptext/vm/vm-wizard/vm-wizard';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { SummaryProvider, SummarySection } from 'app/modules/summary/summary.interface';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-network-interface-step',
  templateUrl: './network-interface-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IxSelectComponent,
    IxInputComponent,
    IxCheckboxComponent,
    FormActionsComponent,
    MatButton,
    MatStepperPrevious,
    TestDirective,
    MatStepperNext,
    TranslateModule,
  ],
})
export class NetworkInterfaceStepComponent implements OnInit, SummaryProvider {
  private formBuilder = inject(FormBuilder);
  private translate = inject(TranslateService);
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private errorHandler = inject(ErrorHandlerService);

  form = this.formBuilder.nonNullable.group({
    nic_type: [VmNicType.Virtio, Validators.required],
    nic_mac: [helptextVmWizard.NIC_mac_value, Validators.pattern(/\b([0-9A-F]{2}[:-]){5}([0-9A-F]){2}\b/i)],
    nic_attach: ['', Validators.required],
    trust_guest_rx_filters: [false],
  });

  readonly helptext = helptextVmWizard;
  readonly nicTypeOptions$ = of(mapToOptions(vmNicTypeLabels, this.translate));
  readonly nicAttachOptions$ = this.api.call('vm.device.nic_attach_choices').pipe(choicesToOptions());

  get isVirtio(): boolean {
    return this.form.value.nic_type === VmNicType.Virtio;
  }

  ngOnInit(): void {
    this.generateRandomMac();
  }

  getSummary(): SummarySection {
    const nicTypeLabel = this.form.value.nic_type ? vmNicTypeLabels.get(this.form.value.nic_type) || '' : '';
    const typeLabel = nicTypeLabel ? this.translate.instant(nicTypeLabel) : '';
    return [
      {
        label: this.translate.instant('NIC'),
        value: `${typeLabel} (${this.form.value.nic_attach})`,
      },
    ];
  }

  private generateRandomMac(): void {
    this.api.call('vm.random_mac')
      .pipe(
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe((mac) => {
        this.form.patchValue({ nic_mac: mac });
        this.cdr.markForCheck();
      });
  }
}
