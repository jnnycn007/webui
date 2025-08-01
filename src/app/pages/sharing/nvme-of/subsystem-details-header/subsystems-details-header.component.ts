import { ChangeDetectionStrategy, Component, input, output, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import {
  filter, switchMap,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { NvmeOfSubsystemDetails } from 'app/interfaces/nvme-of.interface';
import { LoaderService } from 'app/modules/loader/loader.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import {
  SubsystemDeleteDialogComponent,
} from 'app/pages/sharing/nvme-of/subsystem-details-header/subsystem-delete-dialog/subsystem-delete-dialog.component';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-subsystems-details-header',
  imports: [
    MatButton,
    RequiresRolesDirective,
    TestDirective,
    TranslateModule,
  ],
  templateUrl: './subsystems-details-header.component.html',
  styleUrl: './subsystems-details-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubsystemsDetailsHeaderComponent {
  private matDialog = inject(MatDialog);
  private api = inject(ApiService);
  private loader = inject(LoaderService);
  private errorHandler = inject(ErrorHandlerService);

  subsystem = input.required<NvmeOfSubsystemDetails>();

  subsystemRemoved = output();

  protected readonly requiredRoles = [Role.SharingNvmeTargetWrite];

  deleteSubsystem(): void {
    this.matDialog.open(
      SubsystemDeleteDialogComponent,
      { data: this.subsystem(), minWidth: '500px' },
    )
      .afterClosed()
      .pipe(
        filter((data: { confirmed: boolean; force: boolean }) => data?.confirmed),
        switchMap(({ force }) => {
          return this.api.call('nvmet.subsys.delete', [this.subsystem().id, { force }]).pipe(
            this.loader.withLoader(),
            this.errorHandler.withErrorHandler(),
          );
        }),
        untilDestroyed(this),
      ).subscribe(() => {
        this.subsystemRemoved.emit();
      });
  }
}
