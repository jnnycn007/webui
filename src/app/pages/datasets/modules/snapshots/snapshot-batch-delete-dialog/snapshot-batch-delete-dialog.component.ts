import { Component, ChangeDetectionStrategy, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogTitle } from '@angular/material/dialog';
import {
  MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { filter, map } from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { CoreBulkQuery, CoreBulkResponse } from 'app/interfaces/core-bulk.interface';
import { Job } from 'app/interfaces/job.interface';
import { ZfsSnapshot } from 'app/interfaces/zfs-snapshot.interface';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { SnapshotDialogData } from 'app/pages/datasets/modules/snapshots/interfaces/snapshot-dialog-data.interface';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-snapshot-batch-delete-dialog',
  templateUrl: './snapshot-batch-delete-dialog.component.html',
  styleUrls: ['./snapshot-batch-delete-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    TranslateModule,
    ReactiveFormsModule,
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    IxCheckboxComponent,
    MatTooltip,
    RequiresRolesDirective,
    TestDirective,
    MatButton,
    MatDialogClose,
    FormActionsComponent,
    RouterLink,
    MatAnchor,
  ],
})
export class SnapshotBatchDeleteDialog implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);
  private snapshots = inject<ZfsSnapshot[]>(MAT_DIALOG_DATA);

  protected readonly requiredRoles = [Role.SnapshotDelete];

  isJobCompleted = false;
  form = this.fb.group({
    confirm: [false, [Validators.requiredTrue]],
  });

  total = this.snapshots.length;
  dialogData: SnapshotDialogData;
  jobSuccess: boolean[] = [];
  jobErrors: string[] = [];

  get hasClones(): boolean {
    return this.snapshots.some((snapshot) => !!snapshot?.properties?.clones?.value);
  }

  ngOnInit(): void {
    this.dialogData = this.prepareDialogData();
  }

  private prepareDialogData(): SnapshotDialogData {
    const datasets: string[] = [];
    const snapshots: Record<string, string[]> = {};
    this.snapshots.forEach((item) => {
      if (!snapshots[item.dataset]) {
        datasets.push(item.dataset);
        snapshots[item.dataset] = [];
      }

      snapshots[item.dataset].push(item.snapshot_name);
    });

    return { datasets, snapshots };
  }

  onSubmit(): void {
    const snapshots = this.snapshots.map((item) => [item.name]);
    const params: CoreBulkQuery = ['pool.snapshot.delete', snapshots];
    this.api.job('core.bulk', params).pipe(
      filter((job: Job<CoreBulkResponse<boolean>[]>) => !!job.result),
      map((job: Job<CoreBulkResponse<boolean>[]>) => job.result),
      untilDestroyed(this),
    ).subscribe({
      next: (results: CoreBulkResponse<boolean>[]) => {
        results.forEach((item) => {
          if (item.error) {
            this.jobErrors.push(item.error);
          } else {
            this.jobSuccess.push(item.result);
          }
        });
        this.isJobCompleted = true;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.errorHandler.showErrorModal(error);
      },
    });
  }

  getErrorMessage(): string {
    return this.jobErrors.map((error) => error + '\n')
      .toString()
      .split(',')
      .join('')
      .split('[')
      .join('\n *** [')
      .split(']')
      .join(']\n');
  }
}
