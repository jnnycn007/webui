import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Validators, ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialogRef, MatDialogTitle, MatDialogClose } from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { PoolStatus, poolStatusLabels } from 'app/enums/pool-status.enum';
import { Role } from 'app/enums/role.enum';
import { PoolInstance } from 'app/interfaces/pool.interface';
import { FormatDateTimePipe } from 'app/modules/dates/pipes/format-date-time/format-datetime.pipe';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { LoaderService } from 'app/modules/loader/loader.service';
import { FileSizePipe } from 'app/modules/pipes/file-size/file-size.pipe';
import { MapValuePipe } from 'app/modules/pipes/map-value/map-value.pipe';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { AppState } from 'app/store';
import { advancedConfigUpdated } from 'app/store/system-config/system-config.actions';
import { waitForAdvancedConfig } from 'app/store/system-config/system-config.selectors';

@UntilDestroy()
@Component({
  selector: 'ix-bootenv-stats-dialog',
  templateUrl: './bootenv-stats-dialog.component.html',
  styleUrls: ['./bootenv-stats-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    ReactiveFormsModule,
    IxInputComponent,
    FormActionsComponent,
    MatButton,
    MatDialogClose,
    TestDirective,
    RequiresRolesDirective,
    TranslateModule,
    FileSizePipe,
    FormatDateTimePipe,
    MapValuePipe,
  ],
})
export class BootenvStatsDialog implements OnInit {
  private api = inject(ApiService);
  private loader = inject(LoaderService);
  private store$ = inject<Store<AppState>>(Store);
  private dialogRef = inject<MatDialogRef<BootenvStatsDialog>>(MatDialogRef);
  private translate = inject(TranslateService);
  private fb = inject(NonNullableFormBuilder);
  private errorHandler = inject(ErrorHandlerService);
  private formErrorHandler = inject(FormErrorHandlerService);
  private cdr = inject(ChangeDetectorRef);
  private snackbar = inject(SnackbarService);

  form = this.fb.group({
    interval: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  state: PoolInstance | undefined = undefined;

  readonly PoolStatus = PoolStatus;
  readonly poolStatusLabels = poolStatusLabels;
  protected readonly Role = Role;

  get condition(): PoolStatus {
    return this.state.status;
  }

  ngOnInit(): void {
    this.loadBootState();
    this.loadScrubInterval();
  }

  onSubmit(): void {
    const interval = Number(this.form.getRawValue().interval);
    this.api.call('boot.set_scrub_interval', [interval])
      .pipe(this.loader.withLoader(), untilDestroyed(this))
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
          this.store$.dispatch(advancedConfigUpdated());
          this.snackbar.success(
            this.translate.instant('Scrub interval set to {scrubIntervalValue} days', { scrubIntervalValue: interval }),
          );
        },
        error: (error: unknown) => {
          this.formErrorHandler.handleValidationErrors(error, this.form);
        },
      });
  }

  private loadScrubInterval(): void {
    this.store$.pipe(waitForAdvancedConfig, untilDestroyed(this)).subscribe((config) => {
      this.form.patchValue({ interval: config.boot_scrub });
    });
  }

  private loadBootState(): void {
    this.api.call('boot.get_state')
      .pipe(
        this.loader.withLoader(),
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe((state) => {
        this.state = state;
        this.cdr.markForCheck();
      });
  }
}
