import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { Validators, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatAnchor, MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle,
} from '@angular/material/dialog';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { RollbackRecursiveType } from 'app/enums/rollback-recursive-type.enum';
import { helptextSnapshots } from 'app/helptext/storage/snapshots/snapshots';
import { ZfsRollbackParams, ZfsSnapshot } from 'app/interfaces/zfs-snapshot.interface';
import { FormatDateTimePipe } from 'app/modules/dates/pipes/format-date-time/format-datetime.pipe';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxRadioGroupComponent } from 'app/modules/forms/ix-forms/components/ix-radio-group/ix-radio-group.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { LoaderService } from 'app/modules/loader/loader.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-snapshot-rollback-dialog',
  templateUrl: './snapshot-rollback-dialog.component.html',
  styleUrls: ['./snapshot-rollback-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    TranslateModule,
    MatDialogContent,
    MatProgressSpinner,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxRadioGroupComponent,
    IxCheckboxComponent,
    MatButton,
    FormatDateTimePipe,
    RequiresRolesDirective,
    TestDirective,
    MatDialogClose,
    FormActionsComponent,
    RouterLink,
    MatDialogActions,
    MatAnchor,
  ],
})
export class SnapshotRollbackDialog implements OnInit {
  private api = inject(ApiService);
  private loader = inject(LoaderService);
  private fb = inject(FormBuilder);
  private errorHandler = inject(ErrorHandlerService);
  private formErrorHandler = inject(FormErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);
  private snapshotName = inject(MAT_DIALOG_DATA);

  protected readonly requiredRoles = [Role.SnapshotWrite];

  isLoading = true;
  wasDatasetRolledBack = false;
  form = this.fb.group({
    recursive: ['' as RollbackRecursiveType],
    force: [false, [Validators.requiredTrue]],
  });

  publicSnapshot: ZfsSnapshot;

  readonly recursive = {
    fcName: 'recursive',
    tooltip: helptextSnapshots.stopRollbackTooltip,
    label: helptextSnapshots.stopRollbackLabel,
    options: of([
      {
        value: '',
        label: helptextSnapshots.rollbackDatasetLabel,
        tooltip: helptextSnapshots.rollbackDatasetTooltip,
      },
      {
        value: RollbackRecursiveType.Recursive,
        label: helptextSnapshots.rollbackRecursiveLabel,
        tooltip: helptextSnapshots.rollbackRecursiveTooltip,
      },
      {
        value: RollbackRecursiveType.RecursiveClones,
        label: helptextSnapshots.rollbackRecursiveClonesLabel,
        tooltip: helptextSnapshots.rollbackRecursiveClonesTooltip,
      },
    ]),
  };

  readonly force = {
    fcName: 'force',
    label: helptextSnapshots.rollbackConfirm,
    required: true,
  };

  ngOnInit(): void {
    this.getSnapshotCreationInfo();
  }

  /**
   * Gets snapshot creation info
   * Needed only for 'snapshot.created' to use in text
   * Possibly can be removed
   */
  private getSnapshotCreationInfo(): void {
    this.api.call('pool.snapshot.query', [[['id', '=', this.snapshotName]]]).pipe(
      map((snapshots) => snapshots[0]),
      untilDestroyed(this),
    ).subscribe({
      next: (snapshot) => {
        this.publicSnapshot = snapshot;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.errorHandler.showErrorModal(error);
      },
    });
  }

  onSubmit(): void {
    const body: ZfsRollbackParams[1] = {
      force: true,
    };

    if (this.form.value.recursive === RollbackRecursiveType.Recursive) {
      body.recursive = true;
    }

    if (this.form.value.recursive === RollbackRecursiveType.RecursiveClones) {
      body.recursive_clones = true;
    }

    this.api.call('pool.snapshot.rollback', [this.snapshotName, body]).pipe(
      this.loader.withLoader(),
      untilDestroyed(this),
    ).subscribe({
      next: () => {
        this.wasDatasetRolledBack = true;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.formErrorHandler.handleValidationErrors(error, this.form);
      },
    });
  }
}
