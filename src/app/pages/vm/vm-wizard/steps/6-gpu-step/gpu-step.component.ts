import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatStepperPrevious, MatStepperNext } from '@angular/material/stepper';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { helptextVmWizard } from 'app/helptext/vm/vm-wizard/vm-wizard';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { SummaryProvider, SummarySection } from 'app/modules/summary/summary.interface';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { CriticalGpuPreventionService } from 'app/services/gpu/critical-gpu-prevention.service';
import { GpuService } from 'app/services/gpu/gpu.service';
import { IsolatedGpuValidatorService } from 'app/services/gpu/isolated-gpu-validator.service';

@UntilDestroy()
@Component({
  selector: 'ix-gpu-step',
  templateUrl: './gpu-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IxCheckboxComponent,
    IxSelectComponent,
    FormActionsComponent,
    MatButton,
    MatStepperPrevious,
    TestDirective,
    MatStepperNext,
    TranslateModule,
  ],
})
export class GpuStepComponent implements SummaryProvider, OnInit {
  private formBuilder = inject(FormBuilder);
  private gpuValidator = inject(IsolatedGpuValidatorService);
  private translate = inject(TranslateService);
  private gpuService = inject(GpuService);
  private dialog = inject(DialogService);
  private api = inject(ApiService);
  private criticalGpuPrevention = inject(CriticalGpuPreventionService);

  form = this.formBuilder.nonNullable.group({
    hide_from_msr: [false],
    ensure_display_device: [true],
    gpus: [[] as string[], [], [this.gpuValidator.validateGpu]],
  });

  readonly helptext = helptextVmWizard;
  readonly gpuOptions$ = this.gpuService.getGpuOptions();
  criticalGpus = new Map<string, string>();

  ngOnInit(): void {
    // Setup critical GPU prevention
    this.criticalGpus = this.criticalGpuPrevention.setupCriticalGpuPrevention(
      this.form.controls.gpus,
      this,
      this.translate.instant('Cannot Select GPU'),
      this.translate.instant('System critical GPUs cannot be used for VMs'),
    );
  }

  getSummary(): SummarySection {
    const gpusSelected = this.form.getRawValue().gpus.length;
    if (gpusSelected === 0) {
      return [];
    }

    return [
      {
        label: this.translate.instant('GPU'),
        value: this.translate.instant('{n, plural, one {# GPU} other {# GPUs}} isolated', { n: gpusSelected }),
      },
    ];
  }
}
