import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import {
  MatStepper, MatStep, MatStepLabel, MatStepperNext, MatStepperPrevious,
} from '@angular/material/stepper';
import { FormBuilder, FormControl } from '@ngneat/reactive-forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  lastValueFrom, forkJoin,
  of,
} from 'rxjs';
import { patterns } from 'app/constants/name-patterns.constant';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { DatasetType } from 'app/enums/dataset.enum';
import {
  IscsiAuthMethod,
  IscsiExtentRpm,
  IscsiExtentType,
  IscsiExtentUsefor,
  IscsiTargetMode,
} from 'app/enums/iscsi.enum';
import { mntPath } from 'app/enums/mnt-path.enum';
import { Role } from 'app/enums/role.enum';
import { ServiceName } from 'app/enums/service-name.enum';
import { Dataset, DatasetCreate } from 'app/interfaces/dataset.interface';
import { FibreChannelPort } from 'app/interfaces/fibre-channel.interface';
import {
  IscsiExtent,
  IscsiExtentUpdate,
  IscsiInitiatorGroup,
  IscsiInitiatorGroupUpdate,
  IscsiInterface,
  IscsiPortal,
  IscsiPortalUpdate,
  IscsiTarget,
  IscsiTargetExtent,
  IscsiTargetExtentUpdate, IscsiTargetGroup,
  IscsiTargetUpdate,
} from 'app/interfaces/iscsi.interface';
import { newOption } from 'app/interfaces/option.interface';
import { forbiddenValues } from 'app/modules/forms/ix-forms/validators/forbidden-values-validation/forbidden-values-validation';
import { matchOthersFgValidator } from 'app/modules/forms/ix-forms/validators/password-validation/password-validation';
import {
  UseIxIconsInStepperComponent,
} from 'app/modules/ix-icon/use-ix-icons-in-stepper/use-ix-icons-in-stepper.component';
import { LoaderService } from 'app/modules/loader/loader.service';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ProtocolOptionsWizardStepComponent } from 'app/pages/sharing/iscsi/iscsi-wizard/steps/protocol-options-wizard-step/protocol-options-wizard-step.component';
import { TargetWizardStepComponent } from 'app/pages/sharing/iscsi/iscsi-wizard/steps/target-wizard-step/target-wizard-step.component';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { FibreChannelService } from 'app/services/fibre-channel.service';
import { IscsiService } from 'app/services/iscsi.service';
import { checkIfServiceIsEnabled } from 'app/store/services/services.actions';
import { ServicesState } from 'app/store/services/services.reducer';
import { ExtentWizardStepComponent } from './steps/extent-wizard-step/extent-wizard-step.component';

@UntilDestroy()
@Component({
  selector: 'ix-iscsi-wizard',
  templateUrl: './iscsi-wizard.component.html',
  styleUrls: ['./iscsi-wizard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    ReactiveFormsModule,
    MatStepper,
    MatStep,
    MatStepLabel,
    MatButton,
    MatStepperNext,
    TestDirective,
    TargetWizardStepComponent,
    ExtentWizardStepComponent,
    ProtocolOptionsWizardStepComponent,
    MatStepperPrevious,
    RequiresRolesDirective,
    TranslateModule,
    UseIxIconsInStepperComponent,
  ],
})
export class IscsiWizardComponent implements OnInit {
  private fb = inject(FormBuilder);
  private iscsiService = inject(IscsiService);
  private fcService = inject(FibreChannelService);
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private translate = inject(TranslateService);
  private loader = inject(LoaderService);
  private store$ = inject<Store<ServicesState>>(Store);
  slideInRef = inject<SlideInRef<undefined, IscsiTarget>>(SlideInRef);

  isLoading = signal<boolean>(false);
  toStop = signal<boolean>(false);
  namesInUse = signal<string[]>([]);

  createdZvol: Dataset | undefined;
  createdExtent: IscsiExtent | undefined;
  createdPortal: IscsiPortal | undefined;
  createdInitiator: IscsiInitiatorGroup | undefined;
  createdTarget: IscsiTarget | undefined;
  createdTargetExtent: IscsiTargetExtent | undefined;

  form = this.fb.group({
    target: this.fb.group({
      target: [newOption as typeof newOption | number, [Validators.required]],
      mode: [IscsiTargetMode.Iscsi],
    }),
    extent: this.fb.group({
      name: ['', [
        Validators.required,
        forbiddenValues(this.namesInUse()),
        Validators.pattern(patterns.targetDeviceName),
      ]],
      type: [IscsiExtentType.Disk, [Validators.required]],
      path: [mntPath, [Validators.required]],
      filesize: [0, [Validators.required]],
      disk: new FormControl(null as string | null, [Validators.required]),
      dataset: ['', [Validators.required]],
      volsize: new FormControl(null as number | null, [Validators.required]),
      usefor: [IscsiExtentUsefor.Vmware, [Validators.required]],
      product_id: [''],
    }),
    options: this.fb.group({
      portal: new FormControl(null as typeof newOption | number | null, [Validators.required]),
      listen: this.fb.array<string>([]),
      initiators: [[] as string[]],
      fcport: this.fb.group({
        port: [null as string | null],
        host_id: new FormControl(null as number | null, [Validators.required]),
      }),
    }),
  }, {
    validators: [
      matchOthersFgValidator(
        'portal.secret_confirm',
        ['portal.secret'],
        this.translate.instant('Secret Confirm must match Secret'),
      ),
    ],
  });

  protected readonly requiredRoles = [
    Role.SharingIscsiTargetWrite,
    Role.SharingIscsiWrite,
    Role.SharingWrite,
  ];

  get isNewZvol(): boolean {
    return this.form.controls.extent.enabled && this.form.value.extent.disk === newOption;
  }

  get isNewPortal(): boolean {
    return this.form.controls.options.controls.portal.enabled && this.form.value.options.portal === newOption;
  }

  get isNewTarget(): boolean {
    return this.form.value.target.target === newOption;
  }

  get isNewInitiator(): boolean {
    return this.form.controls.options.controls.initiators.enabled;
  }

  get isFibreChannelMode(): boolean {
    return this.form.value.target.mode === IscsiTargetMode.Fc;
  }

  get zvolPayload(): DatasetCreate {
    const value = this.form.value;
    return {
      name: value.extent.dataset.replace(`${mntPath}/`, '') + '/' + value.extent.name,
      type: DatasetType.Volume,
      volsize: value.extent.volsize || undefined,
    };
  }

  get extentPayload(): IscsiExtentUpdate {
    const value = this.form.value.extent;
    const blocksizeDefault = 512;
    const blocksizeModernos = 4096;
    const extentPayload = {
      name: value.name,
      type: value.type,
      blocksize: value.usefor === IscsiExtentUsefor.Modernos ? blocksizeModernos : blocksizeDefault,
      insecure_tpc: true,
      xen: value.usefor === IscsiExtentUsefor.Xen,
      rpm: IscsiExtentRpm.Ssd,
      product_id: value.product_id === '' ? null : value.product_id,
    } as IscsiExtentUpdate;

    if (extentPayload.type === IscsiExtentType.File) {
      const filesize = value.filesize;
      extentPayload.filesize = filesize % blocksizeDefault
        ? (filesize + (blocksizeDefault - filesize % blocksizeDefault))
        : filesize;
      extentPayload.path = value.path;
    } else if (extentPayload.type === IscsiExtentType.Disk) {
      if (value.disk === newOption) {
        extentPayload.disk = 'zvol/' + this.createdZvol.id.replace(' ', '+');
      } else {
        extentPayload.disk = value.disk;
      }
    }
    return extentPayload;
  }

  get portalPayload(): IscsiPortalUpdate {
    const value = this.form.value;
    return {
      comment: value.extent.name,
      listen: value.options.listen.map((ip) => ({ ip } as IscsiInterface)),
    };
  }

  get initiatorPayload(): IscsiInitiatorGroupUpdate {
    const value = this.form.value;
    return {
      comment: value.extent.name,
      ...(value.options.initiators.length ? { initiators: value.options.initiators } : {}),
    };
  }

  get targetPayload(): IscsiTargetUpdate {
    const value = this.form.getRawValue();

    return {
      name: value.extent.name,
      mode: value.target.mode,
      groups: this.isFibreChannelMode
        ? []
        : [{
            portal: this.isNewPortal ? this.createdPortal.id : value.options.portal,
            initiator: this.isNewInitiator ? this.createdInitiator.id : null,
            authmethod: IscsiAuthMethod.None,
            auth: null,
          } as IscsiTargetGroup],
    } as IscsiTargetUpdate;
  }

  get targetExtentPayload(): IscsiTargetExtentUpdate {
    const value = this.form.value;

    return {
      target: this.isNewTarget ? this.createdTarget.id : value.target.target,
      extent: this.createdExtent.id,
    } as IscsiTargetExtentUpdate;
  }

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });

    this.iscsiService.getExtents().pipe(untilDestroyed(this)).subscribe((extents) => {
      this.namesInUse.set(extents.map((extent) => extent.name));
    });
    this.iscsiService.getTargets().pipe(untilDestroyed(this)).subscribe((targets) => {
      this.namesInUse.set(targets.map((target) => target.name));
    });
  }

  ngOnInit(): void {
    this.form.controls.extent.controls.path.disable();
    this.form.controls.extent.controls.filesize.disable();
    this.form.controls.extent.controls.dataset.disable();
    this.form.controls.extent.controls.volsize.disable();
    this.form.controls.options.controls.listen.disable();

    this.form.controls.target.controls.target.valueChanges.pipe(untilDestroyed(this)).subscribe((target) => {
      if (target === newOption) {
        this.form.controls.options.enable();
        this.form.controls.target.controls.mode.setValue(IscsiTargetMode.Iscsi);
      } else {
        this.form.controls.options.disable();
        this.form.controls.options.controls.listen.disable();
      }
    });

    this.form.controls.target.controls.mode.valueChanges.pipe(untilDestroyed(this)).subscribe((mode) => {
      if (mode === IscsiTargetMode.Iscsi) {
        this.form.controls.options.controls.portal.enable();
        this.form.controls.options.controls.initiators.enable();
        this.form.controls.options.controls.fcport.disable();
      } else {
        this.form.controls.options.controls.portal.setValue(null);
        this.form.controls.options.controls.portal.disable();
        this.form.controls.options.controls.initiators.disable();
        this.form.controls.options.controls.fcport.enable();
      }
    });
  }

  private createZvol(payload: DatasetCreate): Promise<Dataset> {
    return lastValueFrom(this.api.call('pool.dataset.create', [payload]));
  }

  private createExtent(payload: IscsiExtentUpdate): Promise<IscsiExtent> {
    return lastValueFrom(this.api.call('iscsi.extent.create', [payload]));
  }

  private createPortal(payload: IscsiPortalUpdate): Promise<IscsiPortal> {
    return lastValueFrom(this.api.call('iscsi.portal.create', [payload]));
  }

  private createInitiator(payload: IscsiInitiatorGroupUpdate): Promise<IscsiInitiatorGroup> {
    return lastValueFrom(this.api.call('iscsi.initiator.create', [payload]));
  }

  private createTarget(payload: IscsiTargetUpdate): Promise<IscsiTarget> {
    return lastValueFrom(this.api.call('iscsi.target.create', [payload]));
  }

  private createTargetFiberChannel(
    targetId: number,
    port: string,
    hostId: number,
  ): Promise<FibreChannelPort | null | true> {
    return lastValueFrom(this.fcService.linkFiberChannelToTarget(targetId, port, hostId));
  }

  private createTargetExtent(payload: IscsiTargetExtentUpdate): Promise<IscsiTargetExtent> {
    return lastValueFrom(this.api.call('iscsi.targetextent.create', [payload]));
  }

  rollBack(): void {
    this.isLoading.set(false);

    const requests = [];

    if (this.createdZvol) {
      requests.push(this.api.call('pool.dataset.delete', [this.createdZvol.id, { recursive: true, force: true }]));
    }

    if (this.createdExtent) {
      requests.push(this.api.call('iscsi.extent.delete', [this.createdExtent.id, true, true]));
    }

    if (this.createdPortal) {
      requests.push(this.api.call('iscsi.portal.delete', [this.createdPortal.id]));
    }

    if (this.createdInitiator) {
      requests.push(this.api.call('iscsi.initiator.delete', [this.createdInitiator.id]));
    }

    if (this.createdTarget) {
      requests.push(this.api.call('iscsi.target.delete', [this.createdTarget.id]));
    }

    if (this.createdTargetExtent) {
      requests.push(this.api.call('iscsi.targetextent.delete', [this.createdTargetExtent.id]));
    }

    if (requests.length) {
      this.loader.open(this.translate.instant('Rollback'));
      forkJoin(requests).pipe(untilDestroyed(this)).subscribe({
        next: () => this.loader.close(),
        error: () => this.loader.close(),
      });
    }
  }

  handleError(error: unknown): void {
    this.toStop.set(true);
    this.errorHandler.showErrorModal(error);
  }

  async onSubmit(): Promise<void> {
    this.isLoading.set(true);
    this.toStop.set(false);

    this.createdZvol = undefined;
    this.createdExtent = undefined;
    this.createdPortal = undefined;
    this.createdInitiator = undefined;
    this.createdTarget = undefined;
    this.createdTargetExtent = undefined;

    if (this.isNewZvol) {
      await this.createZvol(this.zvolPayload).then(
        (createdZvol) => this.createdZvol = createdZvol,
        (err: unknown) => this.handleError(err),
      );
    }

    if (this.toStop()) {
      this.rollBack();
      return;
    }

    await this.createExtent(this.extentPayload).then(
      (createdExtent) => this.createdExtent = createdExtent,
      (err: unknown) => this.handleError(err),
    );

    if (this.toStop()) {
      this.rollBack();
      return;
    }

    if (this.isNewPortal) {
      await this.createPortal(this.portalPayload).then(
        (createdPortal) => this.createdPortal = createdPortal,
        (err: unknown) => this.handleError(err),
      );
    }

    if (this.toStop()) {
      this.rollBack();
      return;
    }

    if (this.isNewInitiator) {
      await this.createInitiator(this.initiatorPayload).then(
        (createdInitiator) => this.createdInitiator = createdInitiator,
        (err: unknown) => this.handleError(err),
      );
    }

    if (this.toStop()) {
      this.rollBack();
      return;
    }

    if (this.isNewTarget) {
      await this.createTarget(this.targetPayload).then(
        (createdTarget) => this.createdTarget = createdTarget,
        (err: unknown) => this.handleError(err),
      );
    }

    if (this.toStop()) {
      this.rollBack();
      return;
    }

    await this.createTargetExtent(this.targetExtentPayload).then(
      (createdTargetExtent) => this.createdTargetExtent = createdTargetExtent,
      (err: unknown) => this.handleError(err),
    );

    if (this.toStop()) {
      this.rollBack();
      return;
    }

    if (this.isNewTarget && this.isFibreChannelMode) {
      await this.createTargetFiberChannel(
        this.createdTarget.id,
        this.form.value.options.fcport.port,
        this.form.value.options.fcport.host_id,
      ).then(() => {}, (err: unknown) => this.handleError(err));
    }

    if (this.toStop()) {
      this.rollBack();
      return;
    }

    this.store$.dispatch(checkIfServiceIsEnabled({ serviceName: ServiceName.Iscsi }));

    this.isLoading.set(false);
    this.slideInRef.close({ response: this.createdTarget });
  }
}
