import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose,
} from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { WINDOW } from 'app/helpers/window.helper';
import { helptextTopbar } from 'app/helptext/topbar';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { TestDirective } from 'app/modules/test-id/test.directive';

@Component({
  selector: 'ix-truecommand-signup-modal',
  templateUrl: './truecommand-signup-modal.component.html',
  styleUrls: ['./truecommand-signup-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    FormActionsComponent,
    MatDialogActions,
    MatButton,
    TestDirective,
    MatDialogClose,
    RequiresRolesDirective,
    TranslateModule,
  ],
})
export class TruecommandSignupModalComponent {
  private dialogRef = inject<MatDialogRef<TruecommandSignupModalComponent>>(MatDialogRef);
  private window = inject<Window>(WINDOW);

  readonly helptext = helptextTopbar;
  protected readonly requiredRoles = [Role.TrueCommandWrite];

  onSignup(): void {
    this.window.open('https://portal.truenas.com');
    this.dialogRef.close(false);
  }
}
