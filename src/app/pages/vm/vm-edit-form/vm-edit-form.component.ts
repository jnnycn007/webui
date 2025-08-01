import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Validators, ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  forkJoin, of, switchMap,
} from 'rxjs';
import { MiB } from 'app/constants/bytes.constant';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import {
  VmBootloader, VmCpuMode, VmDeviceType, VmTime, vmCpuModeLabels, vmTimeNames,
} from 'app/enums/vm.enum';
import { choicesToOptions } from 'app/helpers/operators/options.operators';
import { mapToOptions } from 'app/helpers/options.helper';
import { helptextVmWizard } from 'app/helptext/vm/vm-wizard/vm-wizard';
import { VirtualMachine, VirtualMachineUpdate } from 'app/interfaces/virtual-machine.interface';
import { VmPciPassthroughDevice } from 'app/interfaces/vm-device.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { IxFormatterService } from 'app/modules/forms/ix-forms/services/ix-formatter.service';
import { IxValidatorsService } from 'app/modules/forms/ix-forms/services/ix-validators.service';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { byVmPciSlots } from 'app/pages/vm/utils/by-vm-pci-slots';
import { CpuValidatorService } from 'app/pages/vm/utils/cpu-validator.service';
import { vmCpusetPattern, vmNodesetPattern } from 'app/pages/vm/utils/vm-form-patterns.constant';
import { VmGpuService } from 'app/pages/vm/utils/vm-gpu.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { CriticalGpuPreventionService } from 'app/services/gpu/critical-gpu-prevention.service';
import { GpuService } from 'app/services/gpu/gpu.service';
import { IsolatedGpuValidatorService } from 'app/services/gpu/isolated-gpu-validator.service';

@UntilDestroy()
@Component({
  selector: 'ix-vm-edit-form',
  templateUrl: './vm-edit-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CpuValidatorService],
  standalone: true,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxInputComponent,
    IxSelectComponent,
    IxCheckboxComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class VmEditFormComponent implements OnInit {
  private formBuilder = inject(NonNullableFormBuilder);
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  formatter = inject(IxFormatterService);
  private errorHandler = inject(ErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);
  private cpuValidator = inject(CpuValidatorService);
  private validators = inject(IxValidatorsService);
  private gpuValidator = inject(IsolatedGpuValidatorService);
  private gpuService = inject(GpuService);
  private vmGpuService = inject(VmGpuService);
  private snackbar = inject(SnackbarService);
  private dialog = inject(DialogService);
  private criticalGpuPrevention = inject(CriticalGpuPreventionService);
  slideInRef = inject<SlideInRef<VirtualMachine, boolean>>(SlideInRef);

  protected readonly requiredRoles = [Role.VmWrite];

  showCpuModelField = true;

  form = this.formBuilder.group({
    name: ['', Validators.required],
    description: [''],
    time: [null as VmTime | null],
    bootloader: [null as VmBootloader | null],
    shutdown_timeout: [null as number | null, Validators.min(0)],
    autostart: [false],
    hyperv_enlightenments: [false],
    enable_secure_boot: [false],
    trusted_platform_module: [false],
    vcpus: [null as number | null, [Validators.required, Validators.min(1)], this.cpuValidator.createValidator()],
    cores: [null as number | null, [Validators.required, Validators.min(1)], this.cpuValidator.createValidator()],
    threads: [null as number | null, [Validators.required, Validators.min(1)], this.cpuValidator.createValidator()],
    cpuset: ['', Validators.pattern(vmCpusetPattern)],
    pin_vcpus: [false],
    cpu_mode: [null as VmCpuMode | null],
    cpu_model: [''],
    memory: [null as number | null, this.validators.withMessage(
      Validators.min(256 * MiB),
      this.translate.instant(helptextVmWizard.memory_size_err),
    )],
    min_memory: [null as number | null],
    nodeset: ['', Validators.pattern(vmNodesetPattern)],
    hide_from_msr: [false],
    ensure_display_device: [false],
    gpus: [[] as string[], [], [this.gpuValidator.validateGpu]],
  });

  isLoading = false;
  timeOptions$ = of(mapToOptions(vmTimeNames, this.translate));
  bootloaderOptions$ = this.api.call('vm.bootloader_options').pipe(choicesToOptions());
  cpuModeOptions$ = of(mapToOptions(vmCpuModeLabels, this.translate));
  cpuModelOptions$ = this.api.call('vm.cpu_model_choices').pipe(choicesToOptions());
  gpuOptions$ = this.gpuService.getGpuOptions();

  readonly helptext = helptextVmWizard;
  previouslySetGpuPciIds: string[] = [];
  criticalGpus = new Map<string, string>(); // Maps pci_slot to critical_reason

  protected existingVm: VirtualMachine;

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });
    this.existingVm = this.slideInRef.getData();
  }

  ngOnInit(): void {
    this.listenForFormValueChanges();
    this.setupCriticalGpuPrevention();

    if (this.existingVm) {
      this.setVmForEdit();
    }
  }

  setVmForEdit(): void {
    if (this.existingVm.cpu_mode !== VmCpuMode.Custom) {
      this.showCpuModelField = false;
    }

    this.form.patchValue({
      ...this.existingVm,
      memory: this.existingVm.memory * MiB,
      min_memory: this.existingVm.min_memory ? this.existingVm.min_memory * MiB : null,
    });

    this.setupGpuControl(this.existingVm);
  }

  onSubmit(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    const vmPayload = {
      ...this.form.value,
      memory: Math.round(Number(this.form.value.memory) / MiB),
      min_memory: this.form.value.min_memory
        ? Math.round(this.form.value.min_memory / MiB)
        : null,
    };
    delete vmPayload.gpus;

    if (this.form.controls.cpu_mode.value !== VmCpuMode.Custom) {
      vmPayload.cpu_model = null;
    }

    const gpusIds = this.form.getRawValue().gpus;
    this.gpuService.addIsolatedGpuPciIds(gpusIds).pipe(
      switchMap(() => forkJoin([
        this.api.call('vm.update', [this.existingVm.id, vmPayload as VirtualMachineUpdate]),
        this.vmGpuService.updateVmGpus(this.existingVm, gpusIds),
      ])),
      untilDestroyed(this),
    ).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.snackbar.success(this.translate.instant('VM updated successfully.'));
        this.slideInRef.close({ response: true, error: null });
      },
      error: (error: unknown) => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.errorHandler.showErrorModal(error);
      },
    });
  }

  private setupGpuControl(vm: VirtualMachine): void {
    const vmPciSlots = vm.devices
      .filter((device) => device.attributes.dtype === VmDeviceType.Pci)
      .map((pciDevice: VmPciPassthroughDevice) => pciDevice.attributes.pptdev);

    this.gpuService.getAllGpus().pipe(untilDestroyed(this)).subscribe((allGpus) => {
      const vmGpus = allGpus.filter(byVmPciSlots(vmPciSlots));

      const vmGpuPciSlots = vmGpus.map((gpu) => gpu.addr.pci_slot);
      this.previouslySetGpuPciIds = vmGpuPciSlots;
      this.form.controls.gpus.setValue(vmGpuPciSlots, { emitEvent: false });
    });
  }

  private listenForFormValueChanges(): void {
    this.setPinVcpusRelation();
    this.form.controls.cpu_mode.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((value) => {
        this.showCpuModelField = value === VmCpuMode.Custom;
      });
  }

  private setupCriticalGpuPrevention(): void {
    // Setup critical GPU prevention
    this.criticalGpus = this.criticalGpuPrevention.setupCriticalGpuPrevention(
      this.form.controls.gpus,
      this,
      this.translate.instant('Cannot Select GPU'),
      this.translate.instant('System critical GPUs cannot be used for VMs'),
    );
  }

  private setPinVcpusRelation(): void {
    this.form.controls.cpuset.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((cpuset) => {
        if (cpuset) {
          this.form.controls.pin_vcpus.enable();
        } else {
          this.form.controls.pin_vcpus.disable();
        }
      });
  }
}
