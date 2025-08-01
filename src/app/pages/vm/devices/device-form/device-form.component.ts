import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder, FormControl, Validators, ReactiveFormsModule,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { marker as T } from '@biesbjerg/ngx-translate-extract-marker';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { mntPath } from 'app/enums/mnt-path.enum';
import { Role } from 'app/enums/role.enum';
import {
  VmDeviceType, vmDeviceTypeLabels, VmDiskMode, vmDiskModeLabels, VmNicType, vmNicTypeLabels,
} from 'app/enums/vm.enum';
import { assertUnreachable } from 'app/helpers/assert-unreachable.utils';
import { choicesToOptions } from 'app/helpers/operators/options.operators';
import { mapToOptions } from 'app/helpers/options.helper';
import { helptextDevice } from 'app/helptext/vm/devices/device-add-edit';
import {
  VmDevice, VmDeviceUpdate,
} from 'app/interfaces/vm-device.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { SimpleAsyncComboboxProvider } from 'app/modules/forms/ix-forms/classes/simple-async-combobox-provider';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxComboboxComponent } from 'app/modules/forms/ix-forms/components/ix-combobox/ix-combobox.component';
import { IxErrorsComponent } from 'app/modules/forms/ix-forms/components/ix-errors/ix-errors.component';
import { IxExplorerComponent } from 'app/modules/forms/ix-forms/components/ix-explorer/ix-explorer.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { FilesystemService } from 'app/services/filesystem.service';
import { NetworkService } from 'app/services/network.service';

const specifyCustom = T('Specify custom');

@UntilDestroy()
@Component({
  selector: 'ix-device-form',
  templateUrl: './device-form.component.html',
  styleUrls: ['./device-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxSelectComponent,
    IxExplorerComponent,
    IxComboboxComponent,
    IxInputComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    IxCheckboxComponent,
    IxErrorsComponent,
    FormActionsComponent,
    TranslateModule,
  ],
})
export class DeviceFormComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private snackbar = inject(SnackbarService);
  private networkService = inject(NetworkService);
  private filesystemService = inject(FilesystemService);
  private formErrorHandler = inject(FormErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);
  private dialogService = inject(DialogService);
  private errorHandler = inject(ErrorHandlerService);
  slideInRef = inject<SlideInRef<{
    virtualMachineId?: number;
    device?: VmDevice;
  } | undefined, boolean>>(SlideInRef);

  protected readonly requiredRoles = [Role.VmDeviceWrite];

  isLoading = false;

  get title(): string {
    return this.isNew
      ? this.translate.instant('Add Device')
      : this.translate.instant('Edit Device');
  }

  get isNew(): boolean {
    return !this.existingDevice;
  }

  existingDevice: VmDevice;
  protected slideInData: { virtualMachineId?: number; device?: VmDevice } | undefined;

  typeControl = new FormControl(VmDeviceType.Cdrom, Validators.required);
  orderControl = new FormControl(null as number | null);

  cdromForm = this.formBuilder.nonNullable.group({
    path: [mntPath, Validators.required],
  });

  diskForm = this.formBuilder.group({
    path: ['', Validators.required],
    type: [null as VmDiskMode | null],
    sectorsize: [0],
  });

  nicForm = this.formBuilder.group({
    type: [null as VmNicType | null, Validators.required],
    mac: ['', Validators.pattern(this.networkService.macRegex)],
    nic_attach: ['', Validators.required],
    trust_guest_rx_filters: [false],
  });

  rawFileForm = this.formBuilder.group({
    path: ['', Validators.required],
    sectorsize: [0],
    type: [null as VmDiskMode | null],
    size: [null as number | null],
  });

  pciForm = this.formBuilder.nonNullable.group({
    pptdev: ['', Validators.required],
  });

  displayForm = this.formBuilder.group({
    port: [null as number | null],
    resolution: [''],
    bind: [''],
    password: [''],
    web: [true],
  });

  usbForm = this.formBuilder.group({
    controller_type: ['', Validators.required],
    device: ['', Validators.required],
    usb: this.formBuilder.group({
      vendor_id: ['', Validators.required],
      product_id: ['', Validators.required],
    }),
  });

  readonly helptext = helptextDevice;
  readonly VmDeviceType = VmDeviceType;
  readonly usbDeviceOptions$ = this.api.call('vm.device.usb_passthrough_choices').pipe(
    map((usbDevices) => {
      const options = Object.entries(usbDevices).map(([id, device]) => {
        let label = id;
        label += device.capability?.product ? ` ${device.capability.product}` : '';
        label += device.capability?.vendor ? ` (${device.capability.vendor})` : '';
        return { label, value: id };
      });
      options.push({
        label: this.translate.instant(specifyCustom),
        value: specifyCustom,
      });
      return options;
    }),
  );

  readonly usbControllerOptions$ = this.api.call('vm.device.usb_controller_choices').pipe(
    map((usbControllers) => {
      return Object.entries(usbControllers).map(([key, controller]) => {
        return {
          label: controller,
          value: key,
        };
      });
    }),
  );

  readonly bindOptions$ = this.api.call('vm.device.bind_choices').pipe(choicesToOptions());
  readonly resolutions$ = this.api.call('vm.resolution_choices').pipe(choicesToOptions());
  readonly nicOptions$ = this.api.call('vm.device.nic_attach_choices').pipe(choicesToOptions());
  readonly nicTypes$ = of(mapToOptions(vmNicTypeLabels, this.translate));

  readonly passthroughProvider = new SimpleAsyncComboboxProvider(
    this.api.call('vm.device.passthrough_device_choices').pipe(
      map((passthroughDevices) => {
        return Object.keys(passthroughDevices).map((id) => {
          return {
            label: passthroughDevices[id].description || id,
            value: id,
          };
        });
      }),
    ),
  );

  readonly zvolProvider = new SimpleAsyncComboboxProvider(
    this.api.call('vm.device.disk_choices').pipe(choicesToOptions()),
  );

  readonly fileNodeProvider = this.filesystemService.getFilesystemNodeProvider();

  readonly deviceTypeOptions = mapToOptions(vmDeviceTypeLabels, this.translate);
  readonly deviceTypes$ = new BehaviorSubject(this.deviceTypeOptions);

  readonly diskModes$ = of(mapToOptions(vmDiskModeLabels, this.translate));
  readonly sectorSizes$ = of([
    { label: this.translate.instant('Default'), value: 0 },
    { label: '512', value: 512 },
    { label: '4096', value: 4096 },
  ]);

  get typeSpecificForm(): DeviceFormComponent['cdromForm']
    | DeviceFormComponent['diskForm']
    | DeviceFormComponent['nicForm']
    | DeviceFormComponent['rawFileForm']
    | DeviceFormComponent['pciForm']
    | DeviceFormComponent['usbForm']
    | DeviceFormComponent['displayForm'] {
    switch (this.typeControl.value) {
      case VmDeviceType.Cdrom:
        return this.cdromForm;
      case VmDeviceType.Disk:
        return this.diskForm;
      case VmDeviceType.Nic:
        return this.nicForm;
      case VmDeviceType.Raw:
        return this.rawFileForm;
      case VmDeviceType.Pci:
        return this.pciForm;
      case VmDeviceType.Usb:
        return this.usbForm;
      case VmDeviceType.Display:
        return this.displayForm;
      default:
        assertUnreachable(this.typeControl.value);
        return undefined;
    }
  }

  private virtualMachineId: number;

  constructor() {
    const slideInRef = this.slideInRef;

    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.typeSpecificForm.dirty);
    });
    this.slideInData = slideInRef.getData();
  }

  ngOnInit(): void {
    this.usbForm.controls.usb.disable();
    this.usbForm.controls.device.valueChanges.pipe(untilDestroyed(this)).subscribe((device) => {
      if (device === specifyCustom) {
        this.usbForm.controls.usb.enable();
      } else {
        this.usbForm.controls.usb.disable();
      }
    });

    if (this.slideInData?.virtualMachineId) {
      this.virtualMachineId = this.slideInData.virtualMachineId;
      this.setVirtualMachineId();
    }

    if (this.slideInData?.device) {
      this.existingDevice = this.slideInData.device;
      this.setDeviceForEdit();
    }

    this.handleDeviceTypeChange();
  }

  setVirtualMachineId(): void {
    this.hideDisplayIfCannotBeAdded();
  }

  setDeviceForEdit(): void {
    this.typeControl.setValue(this.existingDevice.attributes.dtype);
    this.orderControl.setValue(this.existingDevice.order);
    switch (this.existingDevice.attributes.dtype) {
      case VmDeviceType.Pci:
        this.pciForm.patchValue(this.existingDevice.attributes);
        break;
      case VmDeviceType.Raw:
        this.rawFileForm.patchValue({
          ...this.existingDevice.attributes,
          sectorsize: this.existingDevice.attributes.logical_sectorsize === null
            ? 0
            : this.existingDevice.attributes.logical_sectorsize,
        });
        break;
      case VmDeviceType.Nic:
        this.nicForm.patchValue(this.existingDevice.attributes);
        break;
      case VmDeviceType.Display:
        this.displayForm.patchValue(this.existingDevice.attributes);
        break;
      case VmDeviceType.Disk:
        this.diskForm.patchValue({
          ...this.existingDevice.attributes,
          sectorsize: this.existingDevice.attributes.logical_sectorsize === null
            ? 0
            : this.existingDevice.attributes.logical_sectorsize,
        });
        break;
      case VmDeviceType.Cdrom:
        this.cdromForm.patchValue(this.existingDevice.attributes);
        break;
      case VmDeviceType.Usb:
        if (!this.existingDevice.attributes.device) {
          this.existingDevice.attributes.device = specifyCustom;
        }
        this.usbForm.patchValue(this.existingDevice.attributes);
        break;
      default:
        assertUnreachable(this.existingDevice as never);
    }
  }

  generateMacAddress(): void {
    this.api.call('vm.random_mac').pipe(
      this.errorHandler.withErrorHandler(),
      untilDestroyed(this),
    ).subscribe((randomMac) => {
      this.nicForm.patchValue({ mac: randomMac });
    });
  }

  handleDeviceTypeChange(): void {
    this.typeControl.valueChanges.pipe(untilDestroyed(this)).subscribe((type) => {
      if (type === VmDeviceType.Nic && this.nicForm.value.mac === '') {
        this.generateMacAddress();
      }
    });
  }

  onSubmit(event: SubmitEvent): void {
    event.preventDefault();

    if (this.typeControl.value === VmDeviceType.Pci) {
      forkJoin([
        this.api.call('vm.device.passthrough_device_choices'),
        this.api.call('system.advanced.config'),
      ])
        .pipe(
          this.errorHandler.withErrorHandler(),
          untilDestroyed(this),
        )
        .subscribe(([passthroughDevices, advancedConfig]) => {
          const dev = this.pciForm.controls.pptdev.value;
          if (!passthroughDevices[dev]?.reset_mechanism_defined && !advancedConfig.isolated_gpu_pci_ids.includes(dev)) {
            this.dialogService.confirm({
              title: this.translate.instant('Warning'),
              message: this.translate.instant('PCI device does not have a reset mechanism defined and you may experience inconsistent/degraded behavior when starting/stopping the VM.'),
            }).pipe(untilDestroyed(this)).subscribe((confirmed) => confirmed && this.onSend());
          } else {
            this.onSend();
          }
        });
    } else {
      this.onSend();
    }
  }

  private onSend(): void {
    this.isLoading = true;

    const update: VmDeviceUpdate = {
      vm: this.virtualMachineId,
      order: this.orderControl.value,
      attributes: this.getUpdateAttributes(),
    };

    const request$ = this.isNew
      ? this.api.call('vm.device.create', [update])
      : this.api.call('vm.device.update', [this.existingDevice.id, update]);

    request$
      .pipe(untilDestroyed(this))
      .subscribe({
        next: () => {
          if (this.isNew) {
            this.snackbar.success(this.translate.instant('Device added'));
          } else {
            this.snackbar.success(this.translate.instant('Device updated'));
          }
          this.isLoading = false;
          this.cdr.markForCheck();
          this.slideInRef.close({ response: true, error: null });
        },
        error: (error: unknown) => {
          this.formErrorHandler.handleValidationErrors(error, this.typeSpecificForm);
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private getUpdateAttributes(): VmDeviceUpdate['attributes'] {
    const values = {
      ...this.typeSpecificForm.value,
      dtype: this.typeControl.value,
    };

    if ('device' in values && values.device === specifyCustom) {
      values.device = null;
    }
    if ('sectorsize' in values) {
      const { sectorsize, ...otherAttributes } = values;
      return {
        ...otherAttributes,
        logical_sectorsize: sectorsize === 0 ? null : sectorsize,
        physical_sectorsize: sectorsize === 0 ? null : sectorsize,
      } as VmDeviceUpdate['attributes'];
    }

    return values as VmDeviceUpdate['attributes'];
  }

  /**
   * Only one display of each type can be added.
   */
  private hideDisplayIfCannotBeAdded(): void {
    this.api.call('vm.get_display_devices', [this.virtualMachineId])
      .pipe(untilDestroyed(this))
      .subscribe((devices) => {
        if (devices.length < 2) {
          return;
        }

        const optionsWithoutDisplay = this.deviceTypeOptions.filter((option) => option.value !== VmDeviceType.Display);
        this.deviceTypes$.next(optionsWithoutDisplay);
      });
  }
}
