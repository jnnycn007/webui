import { Component, ChangeDetectionStrategy, input, output, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { marker } from '@biesbjerg/ngx-translate-extract-marker';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { Group } from 'app/interfaces/group.interface';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import {
  IxTableExpandableRowComponent,
} from 'app/modules/ix-table/components/ix-table-expandable-row/ix-table-expandable-row.component';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import {
  DeleteGroupDialog,
} from 'app/pages/credentials/groups/group-details-row/delete-group-dialog/delete-group-dialog.component';
import { GroupFormComponent } from 'app/pages/credentials/groups/group-form/group-form.component';

@UntilDestroy()
@Component({
  selector: 'ix-group-details-row',
  templateUrl: './group-details-row.component.html',
  styleUrls: ['./group-details-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxTableExpandableRowComponent,
    MatButton,
    TestDirective,
    IxIconComponent,
    RequiresRolesDirective,
    TranslateModule,
    MatTooltip,
  ],
})
export class GroupDetailsRowComponent {
  private slideIn = inject(SlideIn);
  private router = inject(Router);
  private matDialog = inject(MatDialog);

  readonly group = input.required<Group>();
  readonly colspan = input<number>();

  readonly delete = output<number>();

  protected readonly deleteNotAllowedMsg = marker('Groups with privileges or members cannot be deleted.');

  protected readonly Role = Role;

  doEdit(group: Group): void {
    this.slideIn.open(GroupFormComponent, { data: group });
  }

  protected isDeleteDisabled(): boolean {
    return Boolean(this.group()?.roles?.length) || Boolean(this.group()?.users?.length);
  }

  openGroupMembersForm(): void {
    this.router.navigate(['/', 'credentials', 'groups', this.group().id, 'members']);
  }

  doDelete(group: Group): void {
    this.matDialog.open(DeleteGroupDialog, { data: group })
      .afterClosed()
      .pipe(untilDestroyed(this))
      .subscribe((wasDeleted) => {
        if (!wasDeleted) {
          return;
        }

        this.delete.emit(group.id);
      });
  }
}
