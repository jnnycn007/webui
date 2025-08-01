import { ChangeDetectionStrategy, ChangeDetectorRef, Component, input, OnChanges, OnInit, output, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  combineLatest, Observable, of, take,
} from 'rxjs';
import { startWith } from 'rxjs/operators';
import { AclMode, aclModeLabels } from 'app/enums/acl-type.enum';
import {
  DatasetAclType,
  DatasetCaseSensitivity,
  datasetCaseSensitivityLabels,
  DatasetChecksum,
  DatasetPreset,
  DatasetRecordSize,
  DatasetSnapdev,
  datasetSnapdevLabels,
  DatasetSnapdir,
  datasetSnapdirLabels,
  DatasetSync,
  datasetSyncLabels,
} from 'app/enums/dataset.enum';
import { DeduplicationSetting, deduplicationSettingLabels } from 'app/enums/deduplication-setting.enum';
import { LicenseFeature } from 'app/enums/license-feature.enum';
import { OnOff, onOffLabels } from 'app/enums/on-off.enum';
import { ProductType } from 'app/enums/product-type.enum';
import { inherit, WithInherit } from 'app/enums/with-inherit.enum';
import { ZfsPropertySource } from 'app/enums/zfs-property-source.enum';
import { buildNormalizedFileSize } from 'app/helpers/file-size.utils';
import { choicesToOptions, singleArrayToOptions } from 'app/helpers/operators/options.operators';
import { mapToOptions } from 'app/helpers/options.helper';
import { helptextDatasetForm } from 'app/helptext/storage/volumes/datasets/dataset-form';
import { Dataset, DatasetCreate, DatasetUpdate } from 'app/interfaces/dataset.interface';
import { Option } from 'app/interfaces/option.interface';
import { IxSimpleChanges } from 'app/interfaces/simple-changes.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { WarningComponent } from 'app/modules/forms/ix-forms/components/warning/warning.component';
import { IxFormatterService } from 'app/modules/forms/ix-forms/services/ix-formatter.service';
import { ApiService } from 'app/modules/websocket/api.service';
import { DatasetFormService } from 'app/pages/datasets/components/dataset-form/utils/dataset-form.service';
import {
  specialSmallBlockSizeOptions,
} from 'app/pages/datasets/components/dataset-form/utils/special-small-block-size-options.constant';
import { getFieldValue } from 'app/pages/datasets/components/dataset-form/utils/zfs-property.utils';
import { SystemGeneralService } from 'app/services/system-general.service';
import { AppState } from 'app/store';
import { waitForSystemInfo } from 'app/store/system-info/system-info.selectors';

@UntilDestroy()
@Component({
  selector: 'ix-other-options-section',
  styleUrls: ['./other-options-section.component.scss'],
  templateUrl: './other-options-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxFieldsetComponent,
    IxInputComponent,
    TranslateModule,
    ReactiveFormsModule,
    IxSelectComponent,
    WarningComponent,
  ],
})
export class OtherOptionsSectionComponent implements OnInit, OnChanges {
  private formBuilder = inject(NonNullableFormBuilder);
  private translate = inject(TranslateService);
  private store$ = inject<Store<AppState>>(Store);
  private cdr = inject(ChangeDetectorRef);
  private systemGeneralService = inject(SystemGeneralService);
  private dialogService = inject(DialogService);
  private formatter = inject(IxFormatterService);
  private api = inject(ApiService);
  private datasetFormService = inject(DatasetFormService);

  readonly parent = input<Dataset>();
  readonly existing = input<Dataset>();
  readonly datasetPreset = input<DatasetPreset>();
  readonly advancedMode = input<boolean>();

  readonly advancedModeChange = output();
  readonly formValidityChange = output<boolean>();

  hasDeduplication = false;
  hasRecordsizeWarning = false;
  wasDedupChecksumWarningShown = false;
  minimumRecommendedRecordsize = '128K' as DatasetRecordSize;

  readonly form = this.formBuilder.group({
    comments: [''],
    sync: [inherit as WithInherit<DatasetSync>],
    compression: [inherit as WithInherit<string>],
    atime: [inherit as WithInherit<OnOff>],
    deduplication: [inherit as WithInherit<DeduplicationSetting>],
    checksum: [inherit as WithInherit<DatasetChecksum>],
    readonly: [inherit as WithInherit<OnOff>],
    exec: [inherit as WithInherit<OnOff>],
    snapdir: [null as WithInherit<DatasetSnapdir> | null],
    snapdev: [inherit as WithInherit<DatasetSnapdev>],
    copies: [1 as number | null],
    recordsize: [inherit as string],
    acltype: [DatasetAclType.Inherit as DatasetAclType],
    aclmode: [AclMode.Inherit as AclMode],
    casesensitivity: [DatasetCaseSensitivity.Sensitive as DatasetCaseSensitivity],
    special_small_block_size: [inherit as WithInherit<number> | null],
  });

  syncOptions$: Observable<Option[]>;
  compressionOptions$: Observable<Option[]>;
  atimeOptions$: Observable<Option[]>;
  deduplicationOptions$: Observable<Option[]>;
  checksumOptions$: Observable<Option[]>;
  readonlyOptions$: Observable<Option[]>;
  execOptions$: Observable<Option[]>;
  snapdirOptions$ = of(mapToOptions(datasetSnapdirLabels, this.translate));
  snapdevOptions$: Observable<Option[]>;
  copiesOptions$ = of([
    { label: '1', value: 1 },
    { label: '2', value: 2 },
    { label: '3', value: 3 },
  ]);

  recordsizeOptions$: Observable<Option[]>;
  caseSensitivityOptions$ = of(mapToOptions(datasetCaseSensitivityLabels, this.translate));
  specialSmallBlockSizeOptions$: Observable<Option[]>;
  aclTypeOptions$ = of([
    { label: this.translate.instant('Inherit'), value: DatasetAclType.Inherit },
    { label: this.translate.instant('Off'), value: DatasetAclType.Off },
    { label: this.translate.instant('SMB/NFSv4'), value: DatasetAclType.Nfsv4 },
    { label: this.translate.instant('POSIX'), value: DatasetAclType.Posix },
  ]);

  aclModeOptions$ = of(mapToOptions(aclModeLabels, this.translate));

  private readonly defaultSyncOptions$ = of(mapToOptions(datasetSyncLabels, this.translate));
  private readonly defaultCompressionOptions$ = this.api.call('pool.dataset.compression_choices').pipe(choicesToOptions());
  private readonly defaultAtimeOptions$ = of(mapToOptions(onOffLabels, this.translate));
  private defaultDeduplicationOptions$ = of(mapToOptions(deduplicationSettingLabels, this.translate));
  private defaultChecksumOptions$ = this.api.call('pool.dataset.checksum_choices').pipe(
    choicesToOptions(),
  );

  private onOffOptions$ = of(mapToOptions(onOffLabels, this.translate));
  private defaultSnapdevOptions$ = of(mapToOptions(datasetSnapdevLabels, this.translate));
  private defaultRecordSizeOptions$ = this.api.call('pool.dataset.recordsize_choices').pipe(
    singleArrayToOptions(),
  );

  private defaultSpecialSmallBlockSizeOptions$ = of(specialSmallBlockSizeOptions);

  readonly helptext = helptextDatasetForm;

  get hasChecksumWarning(): boolean {
    return this.form.value.checksum === DatasetChecksum.Sha256
      && this.form.value.deduplication !== DeduplicationSetting.Off;
  }

  ngOnChanges(changes: IxSimpleChanges<this>): void {
    if (changes.datasetPreset?.currentValue) {
      this.setUpDatasetPresetSelect();
    }

    if (!changes.existing?.currentValue && !changes.parent?.currentValue) {
      return;
    }

    this.setUpRecordsizeWarning();
    this.setSelectOptions();

    this.setFormValues();

    this.checkDedupChecksum();
    this.setUpDedupWarning();
    this.setUpAclTypeWarning();
    this.updateAclMode();
    this.disableCaseSensitivityOnEdit();
    this.listenForSyncChanges();
  }

  ngOnInit(): void {
    this.checkIfDedupIsSupported();

    this.form.controls.acltype.valueChanges.pipe(untilDestroyed(this)).subscribe(() => {
      this.updateAclMode();
    });

    this.form.statusChanges.pipe(untilDestroyed(this)).subscribe((status) => {
      this.formValidityChange.emit(status === 'VALID');
    });
  }

  getPayload(): Partial<DatasetCreate> | Partial<DatasetUpdate> {
    const values = this.form.value;
    const payload = {
      ...values,
      checksum: values.checksum as DatasetChecksum,
      copies: values.copies || 1,
    };
    if (values.acltype && [DatasetAclType.Posix, DatasetAclType.Off].includes(values.acltype)) {
      payload.aclmode = AclMode.Discard;
    } else if (values.acltype === DatasetAclType.Inherit) {
      payload.aclmode = AclMode.Inherit;
    }

    if (!values.snapdir) {
      delete payload.snapdir;
    }

    return payload as Partial<DatasetCreate> | Partial<DatasetUpdate>;
  }

  private checkIfDedupIsSupported(): void {
    this.hasDeduplication = false;
    this.cdr.markForCheck();

    if (this.systemGeneralService.getProductType() !== ProductType.Enterprise) {
      this.hasDeduplication = true;
      this.cdr.markForCheck();
      return;
    }

    this.store$.pipe(waitForSystemInfo, untilDestroyed(this)).subscribe((systemInfo) => {
      // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
      if (!systemInfo.license || !systemInfo.license.features.includes(LicenseFeature.Dedup)) {
        return;
      }

      this.hasDeduplication = true;
      this.cdr.markForCheck();
    });
  }

  private setFormValues(): void {
    const existing = this.existing();
    if (!existing) {
      return;
    }

    let specialSmallBlockSize: number | null | 'INHERIT' = getFieldValue(existing.special_small_block_size, this.parent()) as (number | 'INHERIT');
    if (specialSmallBlockSize !== 'INHERIT') {
      specialSmallBlockSize = this.formatter.convertHumanStringToNum(specialSmallBlockSize.toString());
    }

    this.form.patchValue({
      comments: existing.comments?.source === ZfsPropertySource.Local ? existing.comments.value : '',
      sync: getFieldValue(existing.sync, this.parent()),
      compression: getFieldValue(existing.compression, this.parent()),
      atime: getFieldValue(existing.atime, this.parent()),
      deduplication: getFieldValue(existing.deduplication, this.parent()),
      checksum: getFieldValue(existing.checksum, this.parent()),
      readonly: getFieldValue(existing.readonly, this.parent()),
      exec: getFieldValue(existing.exec, this.parent()),
      recordsize: getFieldValue(existing.recordsize, this.parent()),
      snapdir: existing.snapdir?.value,
      snapdev: getFieldValue(existing.snapdev, this.parent()),
      copies: existing.copies
        ? Number(existing.copies.value)
        : null,
      acltype: getFieldValue(existing.acltype, this.parent()) as DatasetAclType,
      aclmode: getFieldValue(existing.aclmode, this.parent()) as AclMode,
      casesensitivity: existing.casesensitivity?.value,
      special_small_block_size: existing.special_small_block_size
        ? specialSmallBlockSize
        : null,
    });
  }

  private updateAclMode(): void {
    const aclModeControl = this.form.controls.aclmode;
    const aclTypeControl = this.form.controls.acltype;

    const invalidPosixOrOffAclType = (aclTypeControl.value === DatasetAclType.Posix
      || aclTypeControl.value === DatasetAclType.Off) && aclModeControl.value !== AclMode.Discard;

    const invalidInheritAclType = aclTypeControl.value === DatasetAclType.Inherit
      && aclModeControl.value !== AclMode.Inherit;

    if (!!this.existing() && (invalidPosixOrOffAclType || invalidInheritAclType) && !aclTypeControl.touched) {
      return;
    }

    if (!this.parent()) {
      aclModeControl.disable({ emitEvent: false });
      aclTypeControl.disable({ emitEvent: false });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (aclTypeControl.value) {
      case DatasetAclType.Nfsv4:
        if (!this.existing()) {
          aclModeControl.setValue(AclMode.Passthrough);
        }
        aclModeControl.enable();
        break;
      case DatasetAclType.Posix:
      case DatasetAclType.Off:
        aclModeControl.setValue(AclMode.Discard);
        aclModeControl.disable();
        break;
      case DatasetAclType.Inherit:
        aclModeControl.setValue(AclMode.Inherit);
        aclModeControl.disable();
        break;
    }
  }

  private setSelectOptions(): void {
    const parent = this.parent();
    if (!parent) {
      this.syncOptions$ = this.defaultSyncOptions$;
      this.compressionOptions$ = this.defaultCompressionOptions$;
      this.atimeOptions$ = this.defaultAtimeOptions$;
      this.deduplicationOptions$ = this.defaultDeduplicationOptions$;
      this.checksumOptions$ = this.defaultChecksumOptions$;
      this.readonlyOptions$ = this.onOffOptions$;
      this.execOptions$ = this.onOffOptions$;
      this.snapdevOptions$ = this.defaultSnapdevOptions$;
      this.recordsizeOptions$ = this.defaultRecordSizeOptions$;
      this.specialSmallBlockSizeOptions$ = this.defaultSpecialSmallBlockSizeOptions$;

      return;
    }

    this.syncOptions$ = this.defaultSyncOptions$.pipe(
      this.datasetFormService.addInheritOption(parent.sync.value),
    );
    this.compressionOptions$ = this.defaultCompressionOptions$.pipe(
      this.datasetFormService.addInheritOption(parent.compression.value),
    );
    this.atimeOptions$ = this.defaultAtimeOptions$.pipe(
      this.datasetFormService.addInheritOption(parent.atime.value),
    );
    this.deduplicationOptions$ = this.defaultDeduplicationOptions$.pipe(
      this.datasetFormService.addInheritOption(parent.deduplication.value),
    );
    this.checksumOptions$ = this.defaultChecksumOptions$.pipe(
      this.datasetFormService.addInheritOption(parent.checksum.value),
    );
    this.readonlyOptions$ = this.onOffOptions$.pipe(
      this.datasetFormService.addInheritOption(parent.readonly.value),
    );
    this.execOptions$ = this.onOffOptions$.pipe(
      this.datasetFormService.addInheritOption(parent.exec.value),
    );
    this.snapdevOptions$ = this.defaultSnapdevOptions$.pipe(
      this.datasetFormService.addInheritOption(parent.snapdev.value),
    );

    this.recordsizeOptions$ = this.defaultRecordSizeOptions$.pipe(
      this.datasetFormService.addInheritOption(
        buildNormalizedFileSize(parent.recordsize.parsed),
      ),
    );
    this.specialSmallBlockSizeOptions$ = this.defaultSpecialSmallBlockSizeOptions$.pipe(
      this.datasetFormService.addInheritOption(parent.special_small_block_size.value),
    );
  }

  private setUpDatasetPresetSelect(): void {
    if (!this.datasetPreset() || this.existing()) {
      return;
    }

    if (this.datasetPreset() === DatasetPreset.Smb) {
      this.form.patchValue({
        aclmode: AclMode.Restricted,
        casesensitivity: DatasetCaseSensitivity.Insensitive,
      });
      this.form.controls.aclmode.disable();
      this.form.controls.casesensitivity.disable();
    } else {
      this.form.patchValue({
        aclmode: AclMode.Passthrough,
        casesensitivity: DatasetCaseSensitivity.Sensitive,
      });
      this.form.controls.aclmode.enable();
      this.form.controls.casesensitivity.enable();
    }
  }

  private setUpDedupWarning(): void {
    this.form.controls.deduplication.valueChanges.pipe(untilDestroyed(this)).subscribe((dedup) => {
      if (!dedup || [DeduplicationSetting.Off, inherit].includes(dedup)) {
        this.cdr.markForCheck();
        return;
      }

      this.dialogService.confirm({
        title: this.translate.instant('Warning'),
        message: this.translate.instant(helptextDatasetForm.deduplicationWarning),
        hideCheckbox: true,
      })
        .pipe(untilDestroyed(this))
        .subscribe((confirmed) => {
          if (confirmed) {
            this.checkDedupChecksum();
          } else {
            this.form.patchValue({
              deduplication: inherit,
            });
          }
        });
    });
  }

  private checkDedupChecksum(): void {
    const dedup = this.form.controls.deduplication.value;
    if (!dedup || [DeduplicationSetting.Off, inherit].includes(dedup)) {
      return;
    }

    const checksum = this.form.controls.checksum.value;
    if (
      this.wasDedupChecksumWarningShown
      || !checksum
      || checksum === DatasetChecksum.Sha512
      || checksum !== DatasetChecksum.Sha256
    ) {
      return;
    }

    this.showDedupChecksumWarning();
    this.form.patchValue({
      checksum: DatasetChecksum.Sha512,
    });
  }

  private setUpAclTypeWarning(): void {
    this.form.controls.acltype.valueChanges
      .pipe(take(1), untilDestroyed(this))
      .subscribe(() => {
        this.dialogService.warn(
          this.translate.instant('ACL Types & ACL Modes'),
          helptextDatasetForm.aclTypeChangeWarning,
        );
      });
  }

  private showDedupChecksumWarning(): void {
    this.wasDedupChecksumWarningShown = true;
    this.dialogService.confirm({
      hideCancel: true,
      title: this.translate.instant('Default Checksum Warning'),
      hideCheckbox: true,
      message: this.translate.instant(helptextDatasetForm.deduplicationChecksumWarning),
      buttonText: this.translate.instant('OK'),
    });
  }

  private disableCaseSensitivityOnEdit(): void {
    if (!this.existing()) {
      return;
    }

    this.form.controls.casesensitivity.disable();
  }

  private setUpRecordsizeWarning(): void {
    const parent = this.parent();
    if (!parent) {
      return;
    }

    const root = parent.id.split('/')[0];
    combineLatest([
      this.form.controls.recordsize.valueChanges.pipe(startWith(this.form.controls.recordsize.value)),
      this.api.call('pool.dataset.recommended_zvol_blocksize', [root]),
    ])
      .pipe(untilDestroyed(this))
      .subscribe(([recordsizeValue, recommendedAsString]) => {
        const recordsizeAsString = recordsizeValue === '512' ? '512B' : recordsizeValue;
        const recordsize = this.formatter.memorySizeParsing(recordsizeAsString);
        const recommended = this.formatter.memorySizeParsing(recommendedAsString);

        this.hasRecordsizeWarning = Boolean(recordsize
          && !!recommended
          && recordsizeAsString !== inherit
          && recordsize < recommended);

        this.minimumRecommendedRecordsize = recommendedAsString;

        if (this.hasRecordsizeWarning) {
          this.advancedModeChange.emit();
        }
        this.cdr.markForCheck();
      });
  }

  private listenForSyncChanges(): void {
    this.form.controls.sync.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      if (value === DatasetSync.Disabled && this.form.controls.sync.dirty) {
        this.dialogService.confirm({
          title: this.translate.instant('Warning'),
          message: this.translate.instant(helptextDatasetForm.disabledSyncWarning),
          buttonText: this.translate.instant('Okay'),
          hideCheckbox: true,
          hideCancel: true,
        });
      }
    });
  }
}
