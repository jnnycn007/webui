import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, viewChild, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import {
  MatStepper, MatStep, MatStepLabel, MatStepperPrevious, MatStepperNext,
} from '@angular/material/stepper';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { pick } from 'lodash-es';
import {
  forkJoin, Observable, of, switchMap,
} from 'rxjs';
import { catchError, defaultIfEmpty } from 'rxjs/operators';
import { GiB, MiB } from 'app/constants/bytes.constant';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { VmDeviceType, VmNicType, VmOs } from 'app/enums/vm.enum';
import { VirtualMachine, VirtualMachineUpdate } from 'app/interfaces/virtual-machine.interface';
import { VmDevice, VmDeviceUpdate } from 'app/interfaces/vm-device.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import {
  UseIxIconsInStepperComponent,
} from 'app/modules/ix-icon/use-ix-icons-in-stepper/use-ix-icons-in-stepper.component';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { SummaryComponent } from 'app/modules/summary/summary.component';
import { SummarySection } from 'app/modules/summary/summary.interface';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { VmGpuService } from 'app/pages/vm/utils/vm-gpu.service';
import { OsStepComponent } from 'app/pages/vm/vm-wizard/steps/1-os-step/os-step.component';
import {
  CpuAndMemoryStepComponent,
} from 'app/pages/vm/vm-wizard/steps/2-cpu-and-memory-step/cpu-and-memory-step.component';
import { DiskStepComponent, NewOrExistingDisk } from 'app/pages/vm/vm-wizard/steps/3-disk-step/disk-step.component';
import {
  NetworkInterfaceStepComponent,
} from 'app/pages/vm/vm-wizard/steps/4-network-interface-step/network-interface-step.component';
import {
  InstallationMediaStepComponent,
} from 'app/pages/vm/vm-wizard/steps/5-installation-media-step/installation-media-step.component';
import { GpuStepComponent } from 'app/pages/vm/vm-wizard/steps/6-gpu-step/gpu-step.component';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { ErrorParserService } from 'app/services/errors/error-parser.service';
import { GpuService } from 'app/services/gpu/gpu.service';

@UntilDestroy()
@Component({
  selector: 'ix-vm-wizard',
  templateUrl: './vm-wizard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    MatStepper,
    MatStep,
    MatStepLabel,
    OsStepComponent,
    CpuAndMemoryStepComponent,
    DiskStepComponent,
    NetworkInterfaceStepComponent,
    InstallationMediaStepComponent,
    GpuStepComponent,
    SummaryComponent,
    FormActionsComponent,
    MatButton,
    MatStepperPrevious,
    TestDirective,
    RequiresRolesDirective,
    MatStepperNext,
    TranslateModule,
    UseIxIconsInStepperComponent,
  ],
})
export class VmWizardComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  private dialogService = inject(DialogService);
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private gpuService = inject(GpuService);
  private vmGpuService = inject(VmGpuService);
  private snackbar = inject(SnackbarService);
  private errorParser = inject(ErrorParserService);
  slideInRef = inject<SlideInRef<undefined, boolean>>(SlideInRef);

  protected readonly osStep = viewChild.required(OsStepComponent);
  // TODO: Should be protected, but used in the test.
  readonly cpuAndMemoryStep = viewChild.required(CpuAndMemoryStepComponent);
  readonly diskStep = viewChild.required(DiskStepComponent);
  protected readonly networkInterfaceStep = viewChild.required(NetworkInterfaceStepComponent);
  protected readonly installationMediaStep = viewChild.required(InstallationMediaStepComponent);
  protected readonly gpuStep = viewChild.required(GpuStepComponent);

  protected readonly requiredRoles = [Role.VmWrite];

  get osForm(): OsStepComponent['form']['value'] {
    return this.osStep().form.value;
  }

  get cpuAndMemoryForm(): CpuAndMemoryStepComponent['form']['value'] {
    return this.cpuAndMemoryStep().form.value;
  }

  get diskForm(): DiskStepComponent['form']['value'] {
    return this.diskStep().form.value;
  }

  get nicForm(): NetworkInterfaceStepComponent['form']['value'] {
    return this.networkInterfaceStep().form.value;
  }

  get mediaForm(): InstallationMediaStepComponent['form']['value'] {
    return this.installationMediaStep().form.value;
  }

  get gpuForm(): GpuStepComponent['form']['value'] {
    return this.gpuStep().form.value;
  }

  isLoading = false;
  summary: SummarySection[];

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(Boolean(
        this.osStep()?.form?.dirty
        || this.cpuAndMemoryStep()?.form?.dirty
        || this.diskStep()?.form?.dirty
        || this.networkInterfaceStep()?.form?.dirty
        || this.installationMediaStep()?.form?.dirty
        || this.installationMediaStep()?.form?.dirty
        || this.gpuStep()?.form?.dirty,
      ));
    });
  }

  ngOnInit(): void {
    this.setDefaultsFromOs();
  }

  updateSummary(): void {
    const steps = [
      this.osStep(),
      this.cpuAndMemoryStep(),
      this.diskStep(),
      this.networkInterfaceStep(),
      this.installationMediaStep(),
      this.gpuStep(),
    ];

    this.summary = steps.map((step) => step.getSummary());
  }

  onSubmit(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.createVm().pipe(
      switchMap((vm) => this.createDevices(vm)),
      untilDestroyed(this),
    )
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.slideInRef.close({ response: true, error: null });
          this.snackbar.success(this.translate.instant('Virtual machine created'));
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.isLoading = false;
          this.errorHandler.showErrorModal(error);
          this.cdr.markForCheck();
        },
      });
  }

  private setDefaultsFromOs(): void {
    this.osStep().form.controls.os.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((os) => {
        if (os === VmOs.Windows) {
          this.cpuAndMemoryStep().form.patchValue({
            vcpus: 2,
            cores: 1,
            threads: 1,
            memory: 4 * GiB,
          });
          this.diskStep().form.patchValue({
            volsize: 40 * GiB,
          });
        } else {
          this.cpuAndMemoryStep().form.patchValue({
            vcpus: 1,
            cores: 1,
            threads: 1,
            memory: 512 * MiB,
          });
          this.diskStep().form.patchValue({
            volsize: 10 * GiB,
          });
        }
      });
  }

  private createVm(): Observable<VirtualMachine> {
    const vmPayload = {
      ...pick(this.osForm, [
        'name', 'description', 'time', 'hyperv_enlightenments',
        'bootloader', 'shutdown_timeout', 'autostart', 'enable_secure_boot', 'trusted_platform_module',
      ]),
      ...pick(this.cpuAndMemoryForm, [
        'cpu_mode', 'vcpus', 'cores', 'threads', 'cpuset', 'nodeset', 'pin_vcpus',
      ]),
      cpu_model: this.cpuAndMemoryForm.cpu_model || null,
      // Middleware expects values in MiBs
      memory: this.cpuAndMemoryForm.memory / MiB,
      min_memory: this.cpuAndMemoryForm.min_memory ? this.cpuAndMemoryForm.min_memory / MiB : null,
      ...pick(this.gpuForm, [
        'ensure_display_device', 'hide_from_msr',
      ]),
    } as VirtualMachineUpdate;

    return this.api.call('vm.create', [vmPayload]);
  }

  private createDevices(vm: VirtualMachine): Observable<unknown[]> {
    const requests: Observable<unknown>[] = [
      this.getNicRequest(vm),
      this.getDiskRequest(vm),
    ];

    if (this.mediaForm.iso_path) {
      requests.push(this.getCdromRequest(vm));
    }

    if (this.osForm.enable_display) {
      requests.push(this.getDisplayRequest(vm));
    }

    if (this.gpuForm.gpus.length) {
      requests.push(this.getGpuRequests(vm));
    }

    return forkJoin(requests);
  }

  private getNicRequest(vm: VirtualMachine): Observable<VmDevice | null> {
    return this.makeDeviceRequest(vm.id, {
      attributes: {
        dtype: VmDeviceType.Nic,
        type: this.nicForm.nic_type,
        mac: this.nicForm.nic_mac,
        nic_attach: this.nicForm.nic_attach,
        trust_guest_rx_filters: this.nicForm.nic_type === VmNicType.Virtio
          ? this.nicForm.trust_guest_rx_filters
          : false,
      },
    });
  }

  private getDiskRequest(vm: VirtualMachine): Observable<VmDevice | null> {
    if (this.diskForm.newOrExisting === NewOrExistingDisk.New) {
      const hdd = this.diskForm.datastore + '/' + this.osForm.name.replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(7);
      return this.makeDeviceRequest(vm.id, {
        attributes: {
          dtype: VmDeviceType.Disk,
          create_zvol: true,
          type: this.diskForm.hdd_type,
          physical_sectorsize: null,
          logical_sectorsize: null,
          zvol_name: hdd,
          zvol_volsize: this.diskForm.volsize,
        },
      });
    }

    return this.makeDeviceRequest(vm.id, {
      attributes: {
        dtype: VmDeviceType.Disk,
        path: this.diskForm.hdd_path,
        type: this.diskForm.hdd_type,
        physical_sectorsize: null,
        logical_sectorsize: null,
      },
    });
  }

  private getCdromRequest(vm: VirtualMachine): Observable<VmDevice | null> {
    return this.makeDeviceRequest(vm.id, {
      attributes: {
        dtype: VmDeviceType.Cdrom,
        path: this.mediaForm.iso_path,
      },
    });
  }

  private getGpuRequests(vm: VirtualMachine): Observable<unknown> {
    const gpusIds = this.gpuForm.gpus as unknown as string[];

    return this.gpuService.addIsolatedGpuPciIds(gpusIds).pipe(
      defaultIfEmpty([]),
      switchMap(() => this.vmGpuService.updateVmGpus(vm, gpusIds)),
    );
  }

  private getDisplayRequest(vm: VirtualMachine): Observable<VmDevice | null> {
    return this.api.call('vm.port_wizard').pipe(
      switchMap((port) => {
        return this.makeDeviceRequest(vm.id, {
          attributes: {
            dtype: VmDeviceType.Display,
            port: port.port,
            bind: this.osForm.bind,
            password: this.osForm.password,
            web: true,
            type: this.osForm.display_type,
          },
        });
      }),
    );
  }

  private makeDeviceRequest(vmId: number, payload: VmDeviceUpdate): Observable<VmDevice | null> {
    return this.api.call('vm.device.create', [{
      vm: vmId,
      ...payload,
    }])
      .pipe(
        catchError((error: unknown) => {
          const parsedErrors = this.errorParser.parseError(error);
          const firstReport = Array.isArray(parsedErrors) ? parsedErrors[0] : parsedErrors;
          this.dialogService.error({
            title: this.translate.instant('Error creating device'),
            message: firstReport.message,
          });
          return of(null);
        }),
      );
  }
}
