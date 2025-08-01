import { DecimalPipe } from '@angular/common';
import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngrx/store';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { JobState } from 'app/enums/job-state.enum';
import { Job } from 'app/interfaces/job.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { abortJobPressed } from 'app/modules/jobs/store/job.actions';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { AppState } from 'app/store';

@UntilDestroy()
@Component({
  selector: 'ix-job-name',
  templateUrl: './job-name.component.html',
  styleUrls: ['./job-name.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxIconComponent,
    MatTooltip,
    MatProgressSpinner,
    MatProgressBar,
    MatIconButton,
    TestDirective,
    TranslateModule,
    DecimalPipe,
  ],
})
export class JobNameComponent {
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);
  private store$ = inject<Store<AppState>>(Store);

  readonly job = input.required<Job>();

  protected isRunning = computed(() => this.job().state === JobState.Running);

  protected readonly JobState = JobState;

  onAborted(): void {
    const job = this.job();
    this.dialogService
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
}
