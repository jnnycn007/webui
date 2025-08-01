import { KeyValue, KeyValuePipe } from '@angular/common';
import { Component, ChangeDetectionStrategy, ChangeDetectorRef, TrackByFunction, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogClose,
} from '@angular/material/dialog';
import { marker as T } from '@biesbjerg/ngx-translate-extract-marker';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { ContainerImage, DeleteContainerImageParams } from 'app/interfaces/container-image.interface';
import { CoreBulkResponse } from 'app/interfaces/core-bulk.interface';
import { Job } from 'app/interfaces/job.interface';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { BulkListItemComponent } from 'app/modules/lists/bulk-list-item/bulk-list-item.component';
import { BulkListItem, BulkListItemState } from 'app/modules/lists/bulk-list-item/bulk-list-item.interface';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-docker-image-delete-dialog',
  templateUrl: './docker-image-delete-dialog.component.html',
  styleUrls: ['./docker-image-delete-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    BulkListItemComponent,
    IxCheckboxComponent,
    RequiresRolesDirective,
    MatButton,
    TranslateModule,
    TestDirective,
    KeyValuePipe,
    MatDialogTitle,
    MatDialogClose,
  ],
})
export class DockerImageDeleteDialog {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private errorHandler = inject(ErrorHandlerService);
  private dialogRef = inject<MatDialogRef<DockerImageDeleteDialog>>(MatDialogRef);
  images = inject<ContainerImage[]>(MAT_DIALOG_DATA);

  protected readonly requiredRoles = [Role.AppsWrite];
  protected readonly forceCheckboxTooltip = T('Use force only if other methods fail as it can leave images in a undefined state. \
   You cannot delete Docker Images (even with force) when the image is in use in a running Docker container.');

  form = this.fb.nonNullable.group({
    confirm: [false, [Validators.requiredTrue]],
    force: [false],
  });

  isJobCompleted = false;
  bulkItems = new Map<string, BulkListItem<ContainerImage>>();
  hasErrors = false;

  get successCount(): number {
    return [...this.bulkItems.values()].filter((item) => item.state === BulkListItemState.Success).length;
  }

  get failedCount(): number {
    return [...this.bulkItems.values()].filter((item) => item.state === BulkListItemState.Error).length;
  }

  get runningCount(): number {
    return [...this.bulkItems.values()].filter((item) => item.state === BulkListItemState.Running).length;
  }

  readonly trackByKey: TrackByFunction<KeyValue<string, BulkListItem<ContainerImage>>> = (_, entry) => entry.key;

  constructor() {
    this.images.forEach((image) => {
      this.bulkItems.set(image.id, { state: BulkListItemState.Initial, item: image });
    });
  }

  onSubmit(): void {
    const deleteParams: DeleteContainerImageParams[] = this.images.map((image) => {
      return [image.id, { force: this.form.getRawValue().force }];
    });

    this.images.forEach((image) => {
      this.bulkItems.set(image.id, { state: BulkListItemState.Running, item: image });
    });

    this.api.job('core.bulk', ['app.image.delete', deleteParams]).pipe(
      filter((job: Job<CoreBulkResponse<void>[], DeleteContainerImageParams[]>) => !!job.result),
      this.errorHandler.withErrorHandler(),
      untilDestroyed(this),
    ).subscribe((response) => {
      response.arguments[1].forEach((params, index: number) => {
        if (!params) {
          return;
        }

        const [imageId] = params.toString().split(',');
        const bulkItem = this.bulkItems.get(imageId);
        if (bulkItem) {
          const item = response.result[index];
          if (item.error) {
            this.bulkItems.set(imageId, {
              ...bulkItem,
              state: BulkListItemState.Error,
              message: item.error
                .replace('[EFAULT]', '')
                .replace('DockerError(409, \'', '')
                .replace('\')', ''),
            });
          } else {
            this.bulkItems.set(imageId, {
              ...bulkItem,
              state: BulkListItemState.Success,
              message: '',
            });
            if (this.bulkItems.size === 1) {
              this.dialogRef.close(true);
            }
          }
        }
      });
      this.isJobCompleted = true;
      this.cdr.markForCheck();
    });
  }
}
