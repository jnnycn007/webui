import { AsyncPipe } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialogRef, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import {
  filter, map,
} from 'rxjs/operators';
import { observeJob } from 'app/helpers/operators/observe-job.operator';
import { ApiJobMethod, ApiJobResponse } from 'app/interfaces/api/api-job-directory.interface';
import { Job } from 'app/interfaces/job.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { JobItemComponent } from 'app/modules/jobs/components/job-item/job-item.component';
import { abortJobPressed, jobPanelClosed } from 'app/modules/jobs/store/job.actions';
import {
  JobSlice,
  selectJobState,
  selectRunningJobsCount,
  selectWaitingJobsCount,
  selectFailedJobsCount,
  selectJobsPanelSlice,
  selectJob,
} from 'app/modules/jobs/store/job.selectors';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ignoreTranslation } from 'app/modules/translate/translate.helper';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { ErrorParserService } from 'app/services/errors/error-parser.service';
import { FailedJobError } from 'app/services/errors/error.classes';

@UntilDestroy()
@Component({
  selector: 'ix-jobs-panel',
  templateUrl: './jobs-panel.component.html',
  styleUrls: ['./jobs-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogContent,
    MatTooltip,
    IxIconComponent,
    MatProgressBar,
    JobItemComponent,
    MatDialogActions,
    MatButton,
    TranslateModule,
    AsyncPipe,
    TestDirective,
  ],
})
export class JobsPanelComponent {
  private router = inject(Router);
  private store$ = inject<Store<JobSlice>>(Store);
  private dialogRef = inject<MatDialogRef<JobsPanelComponent>>(MatDialogRef);
  private translate = inject(TranslateService);
  private dialog = inject(DialogService);
  private errorHandler = inject(ErrorHandlerService);
  private errorParser = inject(ErrorParserService);
  private snackbar = inject(SnackbarService);

  isLoading$ = this.store$.select(selectJobState).pipe(map((state) => state.isLoading));
  error$ = this.store$.select(selectJobState).pipe(map((state) => state.error));
  runningJobsCount$ = this.store$.select(selectRunningJobsCount);
  waitingJobsCount$ = this.store$.select(selectWaitingJobsCount);
  failedJobsCount$ = this.store$.select(selectFailedJobsCount);
  availableJobs$ = this.store$.select(selectJobsPanelSlice);

  onAbort(job: Job): void {
    this.dialog
      .confirm({
        title: this.translate.instant('Abort'),
        message: this.translate.instant('Are you sure you want to abort the <b>{task}</b> task?', { task: job.method }),
        hideCheckbox: true,
        buttonText: this.translate.instant('Abort'),
        cancelText: this.translate.instant('Cancel'),
        disableClose: true,
      })
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe(() => {
        this.store$.dispatch(abortJobPressed({ job }));
      });
  }

  openJobDialog(job: Job): void {
    this.dialogRef.close();
    if (job.error) {
      // Do not replace with showErrorModal, because it also reports to Sentry
      const errorReport = this.errorParser.parseError(new FailedJobError(job));
      this.dialog.error(errorReport || {
        title: this.translate.instant('Error'),
        message: this.translate.instant('An unknown error occurred'),
      });
      return;
    }

    const title = job.description ? job.description : job.method;

    const job$ = (
      this.store$.select(
        selectJob(job.id),
      ) as Observable<Job<ApiJobResponse<ApiJobMethod>>>
    ).pipe(
      observeJob(),
    );

    const jobProgressDialogRef = this.dialog.jobDialog(
      job$,
      {
        title: ignoreTranslation(title),
        canMinimize: true,
      },
    );
    jobProgressDialogRef.afterClosed()
      .pipe(
        this.errorHandler.withErrorHandler(),
        untilDestroyed(jobProgressDialogRef.getSubscriptionLimiterInstance()),
      )
      .subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('Job completed successfully'));
        },
      });
  }

  goToJobs(): void {
    this.dialogRef.close();
    this.store$.dispatch(jobPanelClosed());
    this.router.navigate(['/jobs']);
  }
}
