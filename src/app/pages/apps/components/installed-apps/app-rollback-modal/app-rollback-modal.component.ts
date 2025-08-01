import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle,
} from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, of, tap } from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { helptextApps } from 'app/helptext/apps/apps';
import { App, AppRollbackParams } from 'app/interfaces/app.interface';
import { Option } from 'app/interfaces/option.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-app-rollback-modal',
  templateUrl: './app-rollback-modal.component.html',
  styleUrls: ['./app-rollback-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    IxSelectComponent,
    IxCheckboxComponent,
    TranslateModule,
    FormActionsComponent,
    MatButton,
    RequiresRolesDirective,
    TestDirective,
    MatDialogActions,
    MatDialogClose,
  ],
})
export class AppRollbackModalComponent {
  private dialogRef = inject<MatDialogRef<AppRollbackModalComponent>>(MatDialogRef);
  private api = inject(ApiService);
  private dialogService = inject(DialogService);
  private formBuilder = inject(FormBuilder);
  private errorHandler = inject(ErrorHandlerService);
  private translate = inject(TranslateService);
  private app = inject<App>(MAT_DIALOG_DATA);

  form = this.formBuilder.group({
    app_version: ['', Validators.required],
    rollback_snapshot: [false],
  });

  versionOptions$: Observable<Option[]>;

  readonly helptext = helptextApps.apps.rollbackDialog.version.tooltip;
  protected readonly requiredRoles = [Role.AppsWrite];

  constructor() {
    this.setVersionOptions();
  }

  onRollback(): void {
    const rollbackParams = [this.app.name, this.form.value] as Required<AppRollbackParams>;

    this.dialogService.jobDialog(
      this.api.job('app.rollback', rollbackParams),
      { title: this.translate.instant(helptextApps.apps.rollbackDialog.job) },
    )
      .afterClosed()
      .pipe(this.errorHandler.withErrorHandler(), untilDestroyed(this))
      .subscribe(() => this.dialogRef.close(true));
  }

  private setVersionOptions(): void {
    this.api.call('app.rollback_versions', [this.app.name]).pipe(
      tap((versions) => {
        const options = versions.map((version) => ({
          label: version,
          value: version,
        }));
        this.versionOptions$ = of(options);
        if (options.length) {
          this.selectFirstVersion(options[0]);
        }
      }),
      untilDestroyed(this),
    ).subscribe();
  }

  private selectFirstVersion(firstOption: Option): void {
    this.form.patchValue({
      app_version: String(firstOption.value),
    });
  }
}
