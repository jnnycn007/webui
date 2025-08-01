import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, signal, viewChild, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { merge, of } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Direction } from 'app/enums/direction.enum';
import { Role } from 'app/enums/role.enum';
import { SnapshotNamingOption } from 'app/enums/snapshot-naming-option.enum';
import { TransportMode } from 'app/enums/transport-mode.enum';
import { helptextReplicationWizard } from 'app/helptext/data-protection/replication/replication-wizard';
import { CountManualSnapshotsParams } from 'app/interfaces/count-manual-snapshots.interface';
import { KeychainSshCredentials } from 'app/interfaces/keychain-credential.interface';
import { ReplicationCreate, ReplicationTask } from 'app/interfaces/replication-task.interface';
import { AuthService } from 'app/modules/auth/auth.service';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { TreeNodeProvider } from 'app/modules/forms/ix-forms/components/ix-explorer/tree-node-provider.interface';
import { IxFormatterService } from 'app/modules/forms/ix-forms/services/ix-formatter.service';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import {
  GeneralSectionComponent,
} from 'app/pages/data-protection/replication/replication-form/sections/general-section/general-section.component';
import {
  ScheduleSectionComponent,
} from 'app/pages/data-protection/replication/replication-form/sections/schedule-section/schedule-section.component';
import {
  SourceSectionComponent,
} from 'app/pages/data-protection/replication/replication-form/sections/source-section/source-section.component';
import {
  TargetSectionComponent,
} from 'app/pages/data-protection/replication/replication-form/sections/target-section/target-section.component';
import {
  TransportSectionComponent,
} from 'app/pages/data-protection/replication/replication-form/sections/transport-section/transport-section.component';
import {
  ReplicationWizardComponent,
} from 'app/pages/data-protection/replication/replication-wizard/replication-wizard.component';
import { DatasetService } from 'app/services/dataset/dataset.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { ErrorParserService } from 'app/services/errors/error-parser.service';
import { KeychainCredentialService } from 'app/services/keychain-credential.service';
import { ReplicationService } from 'app/services/replication.service';

@UntilDestroy()
@Component({
  selector: 'ix-replication-form',
  templateUrl: './replication-form.component.html',
  styleUrls: ['./replication-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ReplicationService],
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    GeneralSectionComponent,
    TransportSectionComponent,
    SourceSectionComponent,
    TargetSectionComponent,
    ScheduleSectionComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class ReplicationFormComponent implements OnInit {
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private errorParser = inject(ErrorParserService);
  private translate = inject(TranslateService);
  formatter = inject(IxFormatterService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(DialogService);
  private snackbar = inject(SnackbarService);
  private datasetService = inject(DatasetService);
  private replicationService = inject(ReplicationService);
  private keychainCredentials = inject(KeychainCredentialService);
  private authService = inject(AuthService);
  slideInRef = inject<SlideInRef<ReplicationTask | undefined, ReplicationTask | false>>(SlideInRef);

  protected readonly generalSection = viewChild.required(GeneralSectionComponent);
  protected readonly transportSection = viewChild.required(TransportSectionComponent);
  protected readonly sourceSection = viewChild.required(SourceSectionComponent);
  protected readonly targetSection = viewChild.required(TargetSectionComponent);
  protected readonly scheduleSection = viewChild.required(ScheduleSectionComponent);

  protected isLoading = signal(false);

  protected existingReplication: ReplicationTask | undefined;

  sourceNodeProvider: TreeNodeProvider;
  targetNodeProvider: TreeNodeProvider;

  eligibleSnapshotsMessage = '';
  isEligibleSnapshotsMessageRed = false;
  isSudoDialogShown = false;
  sshCredentials: KeychainSshCredentials[] = [];

  protected readonly requiredRoles = [Role.ReplicationTaskWrite, Role.ReplicationTaskWritePull];

  constructor() {
    this.existingReplication = this.slideInRef.getData();
    this.slideInRef.requireConfirmationWhen(() => {
      return of(Boolean(
        this.generalSection()?.form?.dirty
        || this.transportSection()?.form?.dirty
        || this.sourceSection()?.form?.dirty
        || this.targetSection()?.form?.dirty
        || this.scheduleSection()?.form?.dirty,
      ));
    });
  }

  ngOnInit(): void {
    this.countSnapshotsOnChanges();
    this.updateExplorersOnChanges();
    this.updateExplorers();
    this.listenForSudoEnabled();

    if (this.existingReplication) {
      this.setForEdit();
    }
  }

  get isNew(): boolean {
    return !this.existingReplication;
  }

  get sections(): [
    GeneralSectionComponent,
    TransportSectionComponent,
    SourceSectionComponent,
    TargetSectionComponent,
    ScheduleSectionComponent,
  ] {
    return [
      this.generalSection(),
      this.transportSection(),
      this.sourceSection(),
      this.targetSection(),
      this.scheduleSection(),
    ];
  }

  get isLocal(): boolean {
    return this.generalSection().form.controls.transport.value === TransportMode.Local;
  }

  get isPush(): boolean {
    return this.generalSection().form.controls.direction.value === Direction.Push;
  }

  get usesNameRegex(): boolean {
    return this.sourceSection().form.controls.schema_or_regex.value === SnapshotNamingOption.NameRegex;
  }

  get isFormValid(): boolean {
    return this.sections.every((section) => section.form.valid);
  }

  setForEdit(): void {
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    const payload = this.getPayload();

    const operation$ = this.existingReplication
      ? this.api.call('replication.update', [this.existingReplication.id, payload])
      : this.api.call('replication.create', [payload]);

    this.isLoading.set(true);
    operation$
      .pipe(untilDestroyed(this))
      .subscribe(
        {
          next: (response) => {
            this.snackbar.success(
              this.isNew
                ? this.translate.instant('Replication task created.')
                : this.translate.instant('Replication task saved.'),
            );
            this.isLoading.set(false);
            this.slideInRef.close({ response });
          },
          error: (error: unknown) => {
            this.isLoading.set(false);
            this.errorHandler.showErrorModal(error);
          },
        },
      );
  }

  onSwitchToWizard(): void {
    this.slideInRef.swap?.(ReplicationWizardComponent, { wide: true });
  }

  private getPayload(): ReplicationCreate {
    return this.sections.reduce((acc, section) => {
      return { ...acc, ...section.getPayload() } as ReplicationCreate;
    }, {} as ReplicationCreate);
  }

  private countSnapshotsOnChanges(): void {
    merge(
      this.generalSection().form.controls.transport.valueChanges,
      this.generalSection().form.controls.direction.valueChanges,
      this.sourceSection().form.controls.name_regex.valueChanges,
      this.sourceSection().form.controls.also_include_naming_schema.valueChanges,
      this.sourceSection().form.controls.source_datasets.valueChanges,
    )
      .pipe(
        // Workaround for https://github.com/angular/angular/issues/13129
        debounceTime(0),
        untilDestroyed(this),
      )
      .subscribe(() => {
        this.countEligibleManualSnapshots();
      });
  }

  private get canCountSnapshots(): boolean {
    const formValues = this.getPayload();
    return this.isPush
      && Boolean(formValues.source_datasets?.length)
      && (Boolean(formValues.name_regex) || Number(formValues.also_include_naming_schema?.length) > 0);
  }

  private countEligibleManualSnapshots(): void {
    if (!this.canCountSnapshots) {
      this.eligibleSnapshotsMessage = '';
      return;
    }

    const formValues = this.getPayload();
    const payload: CountManualSnapshotsParams = {
      datasets: formValues.source_datasets || [],
      transport: formValues.transport,
      ssh_credentials: formValues.transport === TransportMode.Local ? null : formValues.ssh_credentials,
    };

    if (formValues.name_regex) {
      payload.name_regex = formValues.name_regex;
    } else {
      payload.naming_schema = formValues.also_include_naming_schema;
    }

    this.isLoading.set(true);

    this.authService.hasRole(this.requiredRoles).pipe(
      switchMap((hasRole) => {
        if (hasRole) {
          return this.api.call('replication.count_eligible_manual_snapshots', [payload]);
        }
        return of({ eligible: 0, total: 0 });
      }),
      untilDestroyed(this),
    ).subscribe({
      next: (eligibleSnapshots) => {
        this.isEligibleSnapshotsMessageRed = eligibleSnapshots.eligible === 0;
        this.eligibleSnapshotsMessage = this.translate.instant(
          '{eligible} of {total} existing snapshots of dataset {dataset} would be replicated with this task.',
          {
            eligible: eligibleSnapshots.eligible,
            total: eligibleSnapshots.total,
            dataset: String(formValues.source_datasets),
          },
        );
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.isEligibleSnapshotsMessageRed = true;
        this.eligibleSnapshotsMessage = this.translate.instant('Error counting eligible snapshots.');
        const firstError = this.errorParser.getFirstErrorMessage(error);
        if (firstError) {
          this.eligibleSnapshotsMessage = `${this.eligibleSnapshotsMessage} ${firstError}`;
        }

        this.isLoading.set(false);
      },
    });
  }

  private updateExplorersOnChanges(): void {
    merge(
      this.generalSection().form.controls.direction.valueChanges,
      this.generalSection().form.controls.transport.valueChanges,
      this.transportSection().form.controls.ssh_credentials.valueChanges,
    )
      .pipe(
        // Workaround for https://github.com/angular/angular/issues/13129
        debounceTime(0),
        untilDestroyed(this),
      )
      .subscribe(() => this.updateExplorers());

    this.transportSection().form.controls.ssh_credentials.valueChanges.pipe(untilDestroyed(this)).subscribe(() => {
      this.targetSection().form.controls.target_dataset.reset();
    });
  }

  private updateExplorers(): void {
    const formValues = this.getPayload();
    const localProvider = this.datasetService.getDatasetNodeProvider();
    let remoteProvider: TreeNodeProvider = null;
    if (formValues.ssh_credentials) {
      remoteProvider = this.replicationService.getTreeNodeProvider({
        transport: formValues.transport,
        sshCredential: formValues.ssh_credentials,
      });
    }

    this.sourceNodeProvider = this.isPush || this.isLocal ? localProvider : remoteProvider;
    this.targetNodeProvider = this.isPush && !this.isLocal ? remoteProvider : localProvider;
    this.cdr.markForCheck();
  }

  private listenForSudoEnabled(): void {
    this.keychainCredentials.getSshConnections()
      .pipe(
        switchMap((sshCredentials) => {
          this.sshCredentials = sshCredentials;
          return this.transportSection().form.controls.ssh_credentials.valueChanges;
        }),
        untilDestroyed(this),
      )
      .subscribe((credentialId: number) => {
        const selectedCredential = this.sshCredentials.find((credential) => credential.id === credentialId);
        const isRootUser = selectedCredential?.attributes?.username === 'root';

        if (!selectedCredential || isRootUser || this.isSudoDialogShown) {
          return;
        }

        this.dialog.confirm({
          title: this.translate.instant('Sudo Enabled'),
          message: this.translate.instant(helptextReplicationWizard.sudoWarning),
          hideCheckbox: true,
          buttonText: this.translate.instant('Use Sudo For ZFS Commands'),
        }).pipe(untilDestroyed(this)).subscribe((useSudo) => {
          this.generalSection().form.controls.sudo.setValue(useSudo);
          this.isSudoDialogShown = true;
        });
      });
  }
}
