import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, signal, inject } from '@angular/core';
import { Validators, ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { map, of } from 'rxjs';
import { datasetsRootNode, slashRootNode } from 'app/constants/basic-root-nodes.constant';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { DatasetPreset } from 'app/enums/dataset.enum';
import { ExplorerNodeType } from 'app/enums/explorer-type.enum';
import { mntPath } from 'app/enums/mnt-path.enum';
import { Role } from 'app/enums/role.enum';
import { mapToOptions } from 'app/helpers/options.helper';
import { helptextTruecloudBackup } from 'app/helptext/data-protection/truecloud-backup/cloudsync';
import {
  CloudBackup,
  CloudBackupRestoreParams,
  CloudBackupSnapshot,
  CloudBackupSnapshotDirectoryFileType,
  SnapshotIncludeExclude,
  snapshotIncludeExcludeOptions,
} from 'app/interfaces/cloud-backup.interface';
import { DatasetCreate } from 'app/interfaces/dataset.interface';
import { ExplorerNodeData, TreeNode } from 'app/interfaces/tree-node.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { ExplorerCreateDatasetComponent } from 'app/modules/forms/ix-forms/components/ix-explorer/explorer-create-dataset/explorer-create-dataset.component';
import { IxExplorerComponent } from 'app/modules/forms/ix-forms/components/ix-explorer/ix-explorer.component';
import { TreeNodeProvider } from 'app/modules/forms/ix-forms/components/ix-explorer/tree-node-provider.interface';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxRadioGroupComponent } from 'app/modules/forms/ix-forms/components/ix-radio-group/ix-radio-group.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { FilesystemService } from 'app/services/filesystem.service';

@UntilDestroy()
@Component({
  selector: 'ix-cloud-backup-restore-from-snapshot-form',
  templateUrl: './cloud-backup-restore-from-snapshot-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxRadioGroupComponent,
    IxExplorerComponent,
    ExplorerCreateDatasetComponent,
    IxInputComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
    DatePipe,
  ],
})
export class CloudBackupRestoreFromSnapshotFormComponent implements OnInit {
  private translate = inject(TranslateService);
  private fb = inject(NonNullableFormBuilder);
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private snackbar = inject(SnackbarService);
  private errorHandler = inject(FormErrorHandlerService);
  private filesystemService = inject(FilesystemService);
  private dialogService = inject(DialogService);
  slideInRef = inject<SlideInRef<{
    backup: CloudBackup;
    snapshot: CloudBackupSnapshot;
  }, boolean>>(SlideInRef);

  protected readonly requiredRoles = [Role.CloudBackupWrite];
  readonly mntPath = mntPath;
  readonly helptext = helptextTruecloudBackup;

  protected data: { backup: CloudBackup; snapshot: CloudBackupSnapshot };

  fileNodeProvider: TreeNodeProvider;
  snapshotNodeProvider: TreeNodeProvider;

  readonly includeExcludeOptions$ = of(mapToOptions(snapshotIncludeExcludeOptions, this.translate));

  get title(): string {
    return this.translate.instant('Restore from Snapshot');
  }

  form = this.fb.group({
    target: [null as string | null, Validators.required],
    includeExclude: [SnapshotIncludeExclude.IncludeEverything, Validators.required],
    excludedPaths: [[] as string[], Validators.required],
    excludePattern: [null as string | null, Validators.required],
    subFolder: [''],
    includedPaths: [[] as string[]],
  });

  protected get includedPathsRootNodes(): ExplorerNodeData[] {
    return this.form.controls.subFolder.value
      ? [{ ...datasetsRootNode, path: this.form.controls.subFolder.value, name: this.form.controls.subFolder.value }]
      : [{ ...datasetsRootNode, path: this.backupMntPath, name: this.backupMntPath }];
  }

  protected readonly rootDatasetNode: ExplorerNodeData = datasetsRootNode;
  protected readonly slashRootNode: ExplorerNodeData = slashRootNode;

  protected isLoading = signal(false);

  createDatasetProps: Omit<DatasetCreate, 'name'> = {
    share_type: DatasetPreset.Generic,
  };

  get backupMntPath(): string {
    return this.data.backup.absolute_paths ? this.data.backup.path : '/';
  }

  get isExcludePathsSelected(): boolean {
    return this.form.controls.includeExclude.value === SnapshotIncludeExclude.ExcludePaths;
  }

  get isExcludeByPatternSelected(): boolean {
    return this.form.controls.includeExclude.value === SnapshotIncludeExclude.ExcludeByPattern;
  }

  get isIncludeFromSubfolderSelected(): boolean {
    return this.form.controls.includeExclude.value === SnapshotIncludeExclude.IncludeFromSubFolder;
  }

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });

    this.data = this.slideInRef.getData();
    this.form.patchValue({
      subFolder: this.backupMntPath,
    });
  }

  ngOnInit(): void {
    this.setFileNodeProvider();
    this.setSnapshotNodeProvider();
    this.disableHiddenFields();
    this.listenForFormChanges();
  }

  onSubmit(): void {
    this.isLoading.set(true);

    const params = this.prepareParams();

    this.dialogService.jobDialog(
      this.api.job('cloud_backup.restore', params),
      {
        title: this.translate.instant('Restoring backup'),
        canMinimize: true,
      },
    )
      .afterClosed()
      .pipe(untilDestroyed(this))
      .subscribe({
        complete: () => {
          this.snackbar.success(this.translate.instant('Cloud Backup Restored Successfully'));
          this.isLoading.set(false);
          this.slideInRef.close({ response: true });
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.errorHandler.handleValidationErrors(error, this.form);
        },
      });
  }

  private getSnapshotNodeProvider(): TreeNodeProvider {
    return (node: TreeNode<ExplorerNodeData>) => {
      return this.api.call(
        'cloud_backup.list_snapshot_directory',
        [this.data.backup.id, this.data.snapshot?.id, node.data.path],
      ).pipe(
        map((listing) => {
          const nodes: ExplorerNodeData[] = [];

          listing.forEach((file) => {
            if (file.type === CloudBackupSnapshotDirectoryFileType.Dir && file.path !== node.data.path) {
              nodes.push({
                path: file.path,
                name: file.name,
                type: ExplorerNodeType.Directory,
                hasChildren: true,
              });
            }
          });

          return nodes;
        }),
      );
    };
  }

  private prepareParams(): CloudBackupRestoreParams {
    const subfolder = this.isIncludeFromSubfolderSelected ? this.form.controls.subFolder.value : this.backupMntPath;

    const options = {
      exclude: this.isExcludeByPatternSelected
        ? [this.form.controls.excludePattern.value]
        : this.form.controls.excludedPaths.value.map((path) => path.replace(subfolder, '') || '/'),
      include: this.isIncludeFromSubfolderSelected
        ? this.form.getRawValue().includedPaths.map((path) => path.replace(subfolder, '') || '/')
        : null,
    };

    if (!options.exclude?.length) delete options.exclude;
    if (!options.include?.length) delete options.include;

    return [
      this.data.backup.id,
      this.data.snapshot.id,
      subfolder,
      this.form.controls.target.value,
      options,
    ];
  }

  private listenForFormChanges(): void {
    this.form.controls.includeExclude.valueChanges.pipe(untilDestroyed(this)).subscribe({
      next: () => {
        this.disableHiddenFields();

        if (this.isExcludePathsSelected) {
          this.form.controls.excludedPaths.enable();
        } else if (this.isExcludeByPatternSelected) {
          this.form.controls.excludePattern.enable();
        } else if (this.isIncludeFromSubfolderSelected) {
          this.form.controls.subFolder.enable();
          this.form.controls.includedPaths.enable();
        }

        this.cdr.markForCheck();
        this.form.updateValueAndValidity();
      },
    });

    this.form.controls.subFolder.valueChanges.pipe(untilDestroyed(this)).subscribe({
      next: () => {
        this.form.controls.includedPaths.setValue([]);
      },
    });
  }

  private setFileNodeProvider(): void {
    this.fileNodeProvider = this.filesystemService.getFilesystemNodeProvider({ directoriesOnly: true });
  }

  private setSnapshotNodeProvider(): void {
    this.snapshotNodeProvider = this.getSnapshotNodeProvider();
  }

  private disableHiddenFields(): void {
    this.form.controls.excludePattern.disable();
    this.form.controls.excludedPaths.disable();
    this.form.controls.includedPaths.disable();
    this.form.controls.subFolder.disable();
  }
}
