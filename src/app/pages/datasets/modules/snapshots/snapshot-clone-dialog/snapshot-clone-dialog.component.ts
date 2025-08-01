import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAnchor, MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogClose, MatDialogContent, MatDialogTitle,
} from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { helptextSnapshots } from 'app/helptext/storage/snapshots/snapshots';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { LoaderService } from 'app/modules/loader/loader.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';

@UntilDestroy()
@Component({
  selector: 'ix-snapshot-clone-dialog',
  templateUrl: './snapshot-clone-dialog.component.html',
  styleUrls: ['./snapshot-clone-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    TranslateModule,
    ReactiveFormsModule,
    IxInputComponent,
    FormActionsComponent,
    MatButton,
    RequiresRolesDirective,
    TestDirective,
    MatDialogClose,
    RouterLink,
    MatAnchor,
    MatDialogContent,
  ],
})
export class SnapshotCloneDialog implements OnInit {
  private api = inject(ApiService);
  private loader = inject(LoaderService);
  private fb = inject(FormBuilder);
  private errorHandler = inject(FormErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);
  private snapshotName = inject<string>(MAT_DIALOG_DATA);

  protected readonly requiredRoles = [Role.SnapshotWrite];

  wasDatasetCloned = false;

  form = this.fb.nonNullable.group({
    dataset_dst: ['', Validators.required],
  });

  readonly tooltips = {
    dataset_dst: helptextSnapshots.cloneNameTooltip,
  };

  get datasetName(): string {
    return this.form.getRawValue().dataset_dst;
  }

  ngOnInit(): void {
    this.setDatasetName();
  }

  onSubmit(): void {
    this.api.call('pool.snapshot.clone', [{
      snapshot: this.snapshotName,
      dataset_dst: this.datasetName,
    }])
      .pipe(this.loader.withLoader(), untilDestroyed(this))
      .subscribe({
        next: () => {
          this.wasDatasetCloned = true;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.errorHandler.handleValidationErrors(error, this.form);
        },
      });
  }

  private setDatasetName(): void {
    let suggestedName: string;
    if (this.snapshotName.includes('/')) {
      suggestedName = this.snapshotName.replace('@', '-') + '-clone';
    } else {
      suggestedName = this.snapshotName.replace('@', '/') + '-clone';
    }

    this.form.setValue({ dataset_dst: suggestedName });
  }
}
