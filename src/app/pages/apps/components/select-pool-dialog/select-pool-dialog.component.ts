import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialogClose, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  forkJoin, Observable, of, take,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { helptextApps } from 'app/helptext/apps/apps';
import { Option } from 'app/interfaces/option.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { LoaderService } from 'app/modules/loader/loader.service';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ignoreTranslation } from 'app/modules/translate/translate.helper';
import { ApplicationsService } from 'app/pages/apps/services/applications.service';
import { DockerStore } from 'app/pages/apps/store/docker.store';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-select-pool-dialog',
  templateUrl: './select-pool-dialog.component.html',
  styleUrls: ['./select-pool-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    TranslateModule,
    IxSelectComponent,
    FormActionsComponent,
    MatButton,
    TestDirective,
    MatDialogClose,
    IxCheckboxComponent,
    RequiresRolesDirective,
  ],
})
export class SelectPoolDialog implements OnInit {
  private formBuilder = inject(FormBuilder);
  private dialogService = inject(DialogService);
  private appService = inject(ApplicationsService);
  private router = inject(Router);
  private errorHandler = inject(ErrorHandlerService);
  private loader = inject(LoaderService);
  private translate = inject(TranslateService);
  private dialogRef = inject<MatDialogRef<SelectPoolDialog>>(MatDialogRef);
  private snackbar = inject(SnackbarService);
  private dockerStore = inject(DockerStore);

  protected readonly requiredRoles = [Role.AppsWrite];

  form = this.formBuilder.nonNullable.group({
    pool: [''],
    migrateApplications: [false],
  });

  pools$: Observable<Option[]>;
  private selectedPoolName: string | null = null;

  get showMigrateCheckbox(): boolean {
    const selected = this.form.value.pool;
    return !!this.selectedPoolName && selected && selected !== this.selectedPoolName;
  }

  ngOnInit(): void {
    this.loadPools();
  }

  onSubmit(): void {
    const { pool, migrateApplications } = this.form.getRawValue();

    this.dockerStore.setDockerPool(pool, migrateApplications).pipe(
      untilDestroyed(this),
    ).subscribe(() => {
      this.snackbar.success(
        this.translate.instant('Using pool {name}', { name: this.form.value.pool }),
      );
      this.dialogRef.close(true);
    });
  }

  private loadPools(): void {
    forkJoin([
      this.dockerStore.selectedPool$.pipe(take(1)),
      this.appService.getPoolList(),
    ])
      .pipe(this.loader.withLoader(), untilDestroyed(this))
      .subscribe({
        next: ([selectedPool, pools]) => {
          this.form.patchValue({
            pool: selectedPool || '',
          });

          this.selectedPoolName = selectedPool || null;

          this.form.patchValue({
            pool: selectedPool || '',
          });

          const poolOptions = pools.map((pool) => ({
            label: ignoreTranslation(pool.name),
            value: pool.name,
          }));
          this.pools$ = of(poolOptions);

          if (!pools.length) {
            this.showNoPoolsWarning();
          }
        },
        error: (error: unknown) => {
          this.errorHandler.showErrorModal(error);
          this.dialogRef.close(false);
        },
      });
  }

  private showNoPoolsWarning(): void {
    this.dialogService.confirm({
      title: this.translate.instant(helptextApps.noPool.title),
      message: this.translate.instant(helptextApps.noPool.message),
      hideCheckbox: true,
      buttonText: this.translate.instant(helptextApps.noPool.action),
    }).pipe(untilDestroyed(this)).subscribe((confirmed) => {
      this.dialogRef.close(false);
      if (!confirmed) {
        return;
      }
      this.router.navigate(['/storage', 'create']);
    });
  }
}
