import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, output, inject } from '@angular/core';
import { Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatStepperNext } from '@angular/material/stepper';
import { FormBuilder, FormControl } from '@ngneat/reactive-forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  debounceTime, map, merge, Observable, of, switchMap,
} from 'rxjs';
import { emptyRootNode, datasetsRootNode } from 'app/constants/basic-root-nodes.constant';
import { DatasetSource } from 'app/enums/dataset.enum';
import { Direction } from 'app/enums/direction.enum';
import { EncryptionKeyFormat } from 'app/enums/encryption-key-format.enum';
import { mntPath } from 'app/enums/mnt-path.enum';
import { Role } from 'app/enums/role.enum';
import { SnapshotNamingOption } from 'app/enums/snapshot-naming-option.enum';
import { TransportMode } from 'app/enums/transport-mode.enum';
import { helptextReplicationWizard } from 'app/helptext/data-protection/replication/replication-wizard';
import { CountManualSnapshotsParams, EligibleManualSnapshotsCount } from 'app/interfaces/count-manual-snapshots.interface';
import { KeychainSshCredentials } from 'app/interfaces/keychain-credential.interface';
import { newOption, Option } from 'app/interfaces/option.interface';
import { ReplicationTask } from 'app/interfaces/replication-task.interface';
import { ExplorerNodeData } from 'app/interfaces/tree-node.interface';
import { AuthService } from 'app/modules/auth/auth.service';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { SshCredentialsSelectComponent } from 'app/modules/forms/custom-selects/ssh-credentials-select/ssh-credentials-select.component';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { ixManualValidateError } from 'app/modules/forms/ix-forms/components/ix-errors/ix-errors.component';
import { IxExplorerComponent } from 'app/modules/forms/ix-forms/components/ix-explorer/ix-explorer.component';
import { TreeNodeProvider } from 'app/modules/forms/ix-forms/components/ix-explorer/tree-node-provider.interface';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxRadioGroupComponent } from 'app/modules/forms/ix-forms/components/ix-radio-group/ix-radio-group.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import {
  forbiddenAsyncValues,
} from 'app/modules/forms/ix-forms/validators/forbidden-values-validation/forbidden-values-validation';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SummaryProvider, SummarySection } from 'app/modules/summary/summary.interface';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ReplicationFormComponent } from 'app/pages/data-protection/replication/replication-form/replication-form.component';
import { DatasetService } from 'app/services/dataset/dataset.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { ErrorParserService } from 'app/services/errors/error-parser.service';
import { KeychainCredentialService } from 'app/services/keychain-credential.service';
import { ReplicationService } from 'app/services/replication.service';

@UntilDestroy()
@Component({
  selector: 'ix-replication-what-and-where',
  templateUrl: './replication-what-and-where.component.html',
  styleUrls: ['./replication-what-and-where.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ReplicationService, DatePipe, KeychainCredentialService],
  imports: [
    ReactiveFormsModule,
    IxSelectComponent,
    SshCredentialsSelectComponent,
    IxExplorerComponent,
    IxCheckboxComponent,
    IxRadioGroupComponent,
    IxInputComponent,
    FormActionsComponent,
    MatButton,
    MatStepperNext,
    TestDirective,
    TranslateModule,
  ],
})
export class ReplicationWhatAndWhereComponent implements OnInit, SummaryProvider {
  private formBuilder = inject(FormBuilder);
  private replicationService = inject(ReplicationService);
  private keychainCredentials = inject(KeychainCredentialService);
  private datePipe = inject(DatePipe);
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private datasetService = inject(DatasetService);
  private dialogService = inject(DialogService);
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private errorParser = inject(ErrorParserService);
  private errorHandler = inject(ErrorHandlerService);
  slideInRef = inject<SlideInRef<ReplicationTask, ReplicationTask>>(SlideInRef);

  readonly customRetentionVisibleChange = output<boolean>();

  protected sourceNodeProvider: TreeNodeProvider;
  protected targetNodeProvider: TreeNodeProvider;

  protected targetDatasetsRootNodes: ExplorerNodeData[] = [];
  protected sourceDatasetsRootNodes: ExplorerNodeData[] = [];

  readonly helptext = helptextReplicationWizard;
  readonly mntPath = mntPath;
  readonly defaultNamingSchema = 'auto-%Y-%m-%d_%H-%M';
  sshCredentials: KeychainSshCredentials[] = [];
  snapshotsText = '';
  isSnapshotsWarning = false;
  isSudoDialogShown = false;

  form = this.formBuilder.group({
    exist_replication: new FormControl(null as number | null),

    source_datasets_from: new FormControl(null as DatasetSource | null, [Validators.required]),
    ssh_credentials_source: new FormControl(null as number | typeof newOption | null, [Validators.required]),
    source_datasets: [[] as string[], [Validators.required]],
    recursive: [false],
    custom_snapshots: [false],
    schema_or_regex: [SnapshotNamingOption.NamingSchema],
    naming_schema: [this.defaultNamingSchema, [Validators.required]],
    name_regex: ['', [Validators.required]],

    target_dataset_from: new FormControl(null as DatasetSource | null, [Validators.required]),
    ssh_credentials_target: new FormControl(null as number | typeof newOption | null, [Validators.required]),
    target_dataset: new FormControl(null as string | null, [Validators.required]),
    encryption: [false],
    encryption_inherit: [false],
    encryption_key_format: new FormControl(null as EncryptionKeyFormat | null, [Validators.required]),
    encryption_key_generate: [true],
    encryption_key_hex: ['', [Validators.required]],
    encryption_key_passphrase: ['', [Validators.required]],
    encryption_key_location_truenasdb: [true],
    encryption_key_location: ['', [Validators.required]],

    transport: [TransportMode.Ssh, [Validators.required]],
    sudo: [false],
    name: ['', [Validators.required],
      forbiddenAsyncValues(
        this.api.call('replication.query').pipe(
          map((replications) => replications.map((replication) => replication.name)),
        ),
      ),
    ],
  });

  existReplicationOptions$: Observable<Option[]>;

  transportOptions$ = of([
    { label: this.translate.instant('Encryption (more secure, but slower)'), value: TransportMode.Ssh },
    { label: this.translate.instant('No Encryption (less secure, but faster)'), value: TransportMode.Netcat },
  ]);

  datasetFromOptions$ = of([
    { label: this.translate.instant('On this System'), value: DatasetSource.Local },
    { label: this.translate.instant('On a Different System'), value: DatasetSource.Remote },
  ]);

  schemaOrRegexOptions$ = of([
    {
      label: this.translate.instant(helptextReplicationWizard.namingSchemaLabel),
      value: SnapshotNamingOption.NamingSchema,
    },
    {
      label: this.translate.instant(helptextReplicationWizard.nameRegexLabel),
      value: SnapshotNamingOption.NameRegex,
    },
  ]);

  encryptionKeyFormatOptions$ = of([
    { label: this.translate.instant('HEX'), value: EncryptionKeyFormat.Hex },
    { label: this.translate.instant('PASSPHRASE'), value: EncryptionKeyFormat.Passphrase },
  ]);

  get isRemoteSource(): boolean {
    return this.form.value.source_datasets_from === DatasetSource.Remote;
  }

  get isRemoteTarget(): boolean {
    return this.form.value.target_dataset_from === DatasetSource.Remote;
  }

  get schemaOrRegexLabel(): string {
    return this.form.value.source_datasets_from === DatasetSource.Local
      ? helptextReplicationWizard.nameSchemaOrRegexPush
      : helptextReplicationWizard.nameSchemaOrRegexPull;
  }

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });
  }

  ngOnInit(): void {
    this.disableSource();
    this.disableTarget();
    this.loadExistReplication();
    this.loadSshConnections();
    this.updateExplorersOnChanges();
    this.updateExplorers();

    this.form.controls.source_datasets_from.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      this.disableTransportAndSudo(value, this.form.value.target_dataset_from);
      this.form.controls.source_datasets.setValue([]);
      if (value === DatasetSource.Local) {
        this.selectLocalSource();
      } else if (value === DatasetSource.Remote) {
        this.selectRemoteSource();
      } else {
        this.form.controls.target_dataset_from.enable();
        this.disableSource();
      }
      this.checkCustomVisible();
    });

    this.form.controls.custom_snapshots.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      if (this.form.controls.custom_snapshots.enabled) {
        if (value) {
          this.form.controls.schema_or_regex.enable();
          this.form.controls.naming_schema.enable();
        } else {
          this.getSnapshots();
          this.disableCustomSnapshots();
        }
      }
      this.checkCustomVisible();
    });

    this.form.controls.schema_or_regex.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      if (this.form.controls.schema_or_regex.enabled) {
        if (value === SnapshotNamingOption.NameRegex) {
          this.form.controls.name_regex.enable();
          this.form.controls.naming_schema.disable();
        } else {
          this.form.controls.name_regex.disable();
          this.form.controls.naming_schema.enable();
        }
      }
      this.checkCustomVisible();
    });

    this.form.controls.target_dataset_from.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      this.form.controls.target_dataset.setValue('');
      this.disableTransportAndSudo(this.form.value.source_datasets_from, value);
      if (value === DatasetSource.Local) {
        this.form.controls.ssh_credentials_target.disable();
        this.form.controls.target_dataset.enable();
        this.form.controls.encryption.enable();
      } else if (value === DatasetSource.Remote) {
        this.form.controls.ssh_credentials_target.enable();
        this.form.controls.target_dataset.enable();
        this.form.controls.encryption.enable();
      } else {
        this.disableTarget();
      }
    });

    this.form.controls.encryption_inherit.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      if (value) {
        this.disableEncryption();
      } else {
        this.enableEncryption();
      }
    });

    this.form.controls.encryption.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      if (value && !this.form.controls.encryption_inherit.value) {
        this.enableEncryption();
      } else {
        this.disableEncryption();
      }
    });

    this.form.controls.encryption_key_format.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      if (this.form.controls.encryption_key_format.enabled) {
        if (value === EncryptionKeyFormat.Hex) {
          this.form.controls.encryption_key_generate.enable();
          this.form.controls.encryption_key_passphrase.disable();
        } else if (value === EncryptionKeyFormat.Passphrase) {
          this.form.controls.encryption_key_passphrase.enable();
          this.form.controls.encryption_key_generate.setValue(true);
          this.form.controls.encryption_key_generate.disable();
        }
      }
    });

    this.form.controls.encryption_key_generate.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      if (this.form.controls.encryption_key_generate.enabled) {
        if (value) {
          this.form.controls.encryption_key_hex.disable();
        } else {
          this.form.controls.encryption_key_hex.enable();
        }
      }
    });

    this.form.controls.encryption_key_location_truenasdb.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      if (this.form.controls.encryption_key_location_truenasdb.enabled) {
        if (value) {
          this.form.controls.encryption_key_location.disable();
        } else {
          this.form.controls.encryption_key_location.enable();
        }
      }
    });

    this.form.controls.source_datasets.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      this.genTaskName(value || [], this.form.value.target_dataset || '');
      this.getSnapshots();
    });

    this.form.controls.target_dataset.valueChanges.pipe(untilDestroyed(this)).subscribe((value) => {
      this.genTaskName(this.form.value.source_datasets || [], value || '');
    });

    merge(
      this.form.controls.naming_schema.valueChanges,
      this.form.controls.name_regex.valueChanges,
    ).pipe(debounceTime(300), untilDestroyed(this)).subscribe(() => this.getSnapshots());

    merge(
      this.form.controls.ssh_credentials_source.valueChanges,
      this.form.controls.ssh_credentials_target.valueChanges,
    )
      .pipe(untilDestroyed(this))
      .subscribe((credentialId: number) => {
        const selectedCredential = this.sshCredentials.find((credential) => credential.id === credentialId);
        const isRootUser = selectedCredential?.attributes?.username === 'root';
        const isNonRemote = !(this.isRemoteSource || this.isRemoteTarget);

        if (!selectedCredential || isRootUser || isNonRemote || this.isSudoDialogShown) {
          return;
        }

        this.dialogService.confirm({
          title: this.translate.instant('Sudo Enabled'),
          message: this.translate.instant(helptextReplicationWizard.sudoWarning),
          hideCheckbox: true,
          buttonText: this.translate.instant('Use Sudo For ZFS Commands'),
        }).pipe(untilDestroyed(this)).subscribe((useSudo) => {
          this.form.controls.sudo.setValue(useSudo);
          this.isSudoDialogShown = true;
        });
      });
  }

  private loadReplicationTask(task: ReplicationTask): void {
    if (!task) {
      return;
    }

    if (task.direction === Direction.Push) {
      this.form.patchValue({
        source_datasets_from: DatasetSource.Local,
        target_dataset_from: task.ssh_credentials ? DatasetSource.Remote : DatasetSource.Local,
      });
      if (task.ssh_credentials) {
        this.form.controls.ssh_credentials_target.setValue(task.ssh_credentials?.id);
      }
    } else {
      this.form.patchValue({
        source_datasets_from: DatasetSource.Remote,
        target_dataset_from: DatasetSource.Local,
        ssh_credentials_source: task.ssh_credentials?.id,
      });
    }

    const sourcePrefix = this.form.value.source_datasets_from === DatasetSource.Remote ? '' : `${mntPath}/`;
    const targetPrefix = this.form.value.target_dataset_from === DatasetSource.Remote ? '' : `${mntPath}/`;
    this.form.patchValue({
      source_datasets: task.source_datasets.map((item) => sourcePrefix + item),
      target_dataset: targetPrefix + task.target_dataset,
      transport: task.transport,
      name: task.name,
    });
  }

  private clearReplicationTask(): void {
    this.form.patchValue({
      source_datasets_from: null,
      ssh_credentials_source: null,
      source_datasets: [],
      recursive: false,
      custom_snapshots: false,
      schema_or_regex: SnapshotNamingOption.NamingSchema,
      naming_schema: 'auto-%Y-%m-%d_%H-%M',
      name_regex: '',

      target_dataset_from: null,
      ssh_credentials_target: null,
      target_dataset: null,
      encryption: false,
      encryption_key_format: null,
      encryption_key_generate: true,
      encryption_key_hex: '',
      encryption_key_passphrase: '',
      encryption_key_location_truenasdb: true,
      encryption_key_location: '',

      transport: TransportMode.Ssh,
      sudo: false,
      name: '',
    });
  }

  openAdvanced(): void {
    this.slideInRef.swap?.(ReplicationFormComponent, { wide: true });
  }

  getSnapshots(): void {
    const value = this.form.value;
    let transport = value.transport || TransportMode.Local;
    if (value.ssh_credentials_target) {
      transport = TransportMode.Local;
    }

    const payload: CountManualSnapshotsParams = {
      datasets: value.source_datasets?.map((item) => item.replace(`${mntPath}/`, '')) || [],
      transport: value.ssh_credentials_target ? TransportMode.Local : transport,
      ssh_credentials: transport === TransportMode.Local ? null : value.ssh_credentials_source as number,
    };

    if (value.schema_or_regex === SnapshotNamingOption.NameRegex) {
      payload.name_regex = value.name_regex;
    } else {
      payload.naming_schema = value.naming_schema ? value.naming_schema?.split(' ') : [this.defaultNamingSchema];
    }

    if (payload.datasets.length > 0 && (payload.naming_schema || payload.name_regex)) {
      this.authService.hasRole([
        Role.ReplicationTaskWrite,
        Role.ReplicationTaskWritePull,
      ]).pipe(
        switchMap((hasRole) => {
          if (hasRole) {
            return this.api.call('replication.count_eligible_manual_snapshots', [payload]);
          }
          return of({ eligible: 0, total: 0 });
        }),
        untilDestroyed(this),
      ).subscribe({
        next: (snapshotCount: EligibleManualSnapshotsCount) => {
          let snapexpl = '';
          this.isSnapshotsWarning = false;
          if (snapshotCount.eligible === 0) {
            if (value.source_datasets_from === DatasetSource.Local) {
              snapexpl = this.translate.instant('Snapshots will be created automatically.');
            } else {
              this.isSnapshotsWarning = true;
            }
          }
          this.snapshotsText = `${this.translate.instant('{count} snapshots found.', { count: snapshotCount.eligible })} ${snapexpl}`;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.snapshotsText = '';
          const errorMessage = this.errorParser.getFirstErrorMessage(error);
          if (errorMessage) {
            this.form.controls.source_datasets.setErrors({ [ixManualValidateError]: { message: errorMessage } });
          }
          this.cdr.markForCheck();
        },
      });
    } else {
      this.snapshotsText = '';
      this.cdr.markForCheck();
    }
  }

  private checkCustomVisible(): void {
    const hideCustomRetention = this.form.value.schema_or_regex === SnapshotNamingOption.NameRegex
      && (this.form.value.custom_snapshots || this.form.value.source_datasets_from === DatasetSource.Remote);

    this.customRetentionVisibleChange.emit(!hideCustomRetention);
  }

  getSummary(): SummarySection {
    const values = this.form.value;

    return [
      {
        label: this.translate.instant(helptextReplicationWizard.sourceDatasetsLabel),
        value: values.source_datasets.join(','),
      },
      {
        label: this.translate.instant(helptextReplicationWizard.targetDatasetLabel),
        value: values.target_dataset || '',
      },
    ];
  }

  getPayload(): ReplicationWhatAndWhereComponent['form']['value'] {
    return this.form.value;
  }

  private loadExistReplication(): void {
    this.replicationService
      .getReplicationTasks()
      .pipe(
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe(
        (tasks: ReplicationTask[]) => {
          const options: Option[] = [];
          for (const task of tasks) {
            if (task.transport !== TransportMode.Legacy) {
              const exp = task.state?.datetime
                ? this.translate.instant('last run {date}', {
                  date: this.datePipe.transform(new Date(task.state.datetime.$date), 'MM/dd/yyyy'),
                })
                : this.translate.instant('never ran');
              const label = `${task.name} (${exp})`;
              options.push({ label, value: task.id });
            }
          }
          this.existReplicationOptions$ = of(options);
          this.cdr.markForCheck();

          this.form.controls.exist_replication.valueChanges.pipe(untilDestroyed(this)).subscribe((value: number) => {
            const selectedTask = tasks.find((task) => task.id === value);
            if (selectedTask) {
              this.loadReplicationTask(selectedTask);
            } else {
              this.clearReplicationTask();
            }
          });
        },
      );
  }

  private loadSshConnections(): void {
    this.keychainCredentials.getSshConnections()
      .pipe(untilDestroyed(this))
      .subscribe((connections) => {
        this.sshCredentials = connections;
      });
  }

  private genTaskName(source: string[], target: string): void {
    source = source.map((item) => item.replace(`${mntPath}/`, ''));
    target = target.replace(`${mntPath}/`, '');
    if (!source.length && !target) {
      this.form.controls.name.setValue('');
      return;
    }
    const suggestName = source.length > 3
      ? `${source[0]},...,${source[source.length - 1]} - ${target}`
      : `${source.join(',')} - ${target}`;
    this.form.controls.name.setValue(suggestName);
  }

  private disableSource(): void {
    this.form.controls.ssh_credentials_source.disable();
    this.form.controls.source_datasets.disable();
    this.form.controls.recursive.disable();
    this.form.controls.custom_snapshots.disable();
    this.disableCustomSnapshots();
  }

  private disableCustomSnapshots(): void {
    this.form.controls.schema_or_regex.setValue(SnapshotNamingOption.NamingSchema);
    this.form.controls.schema_or_regex.disable();
    this.form.controls.naming_schema.disable();
    this.form.controls.name_regex.disable();
  }

  private disableTarget(): void {
    this.form.controls.target_dataset.disable();
    this.form.controls.ssh_credentials_target.disable();
    this.form.controls.encryption.disable();
    this.disableEncryption();
  }

  private disableEncryption(): void {
    this.form.controls.encryption_key_format.disable();
    this.form.controls.encryption_key_generate.disable();
    this.form.controls.encryption_key_hex.disable();
    this.form.controls.encryption_key_passphrase.disable();
    this.form.controls.encryption_key_location_truenasdb.disable();
    this.form.controls.encryption_key_location.disable();
  }

  private enableEncryption(): void {
    this.form.controls.encryption_key_format.enable();
    this.form.controls.encryption_key_location_truenasdb.enable();
  }

  private disableTransportAndSudo(source: DatasetSource, target: DatasetSource): void {
    if (source === DatasetSource.Remote || target === DatasetSource.Remote) {
      this.form.controls.transport.enable();
      this.form.controls.sudo.enable();
    } else {
      this.form.controls.transport.disable();
      this.form.controls.sudo.disable();
    }
  }

  private selectLocalSource(): void {
    this.form.controls.target_dataset_from.enable();
    this.form.controls.ssh_credentials_source.disable();
    this.form.controls.source_datasets.enable();
    this.form.controls.recursive.enable();
    this.form.controls.custom_snapshots.enable();
    this.form.controls.custom_snapshots.setValue(false);
  }

  private selectRemoteSource(): void {
    this.form.controls.target_dataset_from.setValue(DatasetSource.Local);
    this.form.controls.target_dataset_from.disable();
    this.form.controls.ssh_credentials_source.enable();
    this.form.controls.source_datasets.enable();
    this.form.controls.recursive.enable();
    this.form.controls.custom_snapshots.enable();
    this.form.controls.custom_snapshots.setValue(true);
    this.form.controls.custom_snapshots.disable();
  }

  private updateExplorersOnChanges(): void {
    merge(
      this.form.controls.transport.valueChanges,
      this.form.controls.ssh_credentials_source.valueChanges,
      this.form.controls.ssh_credentials_target.valueChanges,
    )
      .pipe(
        // Workaround for https://github.com/angular/angular/issues/13129
        debounceTime(0),
        untilDestroyed(this),
      )
      .subscribe(() => this.updateExplorers());
  }

  private updateExplorers(): void {
    const formValues = this.getPayload();
    const localProvider = this.datasetService.getDatasetNodeProvider();
    let remoteProvider: TreeNodeProvider = null;

    if (formValues.ssh_credentials_source || formValues.ssh_credentials_target) {
      remoteProvider = this.replicationService.getTreeNodeProvider({
        transport: formValues.transport,
        sshCredential: (formValues.ssh_credentials_source || formValues.ssh_credentials_target) as number,
      });
    }

    this.sourceNodeProvider = !this.isRemoteSource ? localProvider : remoteProvider;
    this.targetNodeProvider = this.isRemoteTarget ? remoteProvider : localProvider;
    this.targetDatasetsRootNodes = this.isRemoteTarget ? [emptyRootNode] : [datasetsRootNode];
    this.sourceDatasetsRootNodes = this.isRemoteSource ? [emptyRootNode] : [datasetsRootNode];

    this.cdr.markForCheck();
  }
}
