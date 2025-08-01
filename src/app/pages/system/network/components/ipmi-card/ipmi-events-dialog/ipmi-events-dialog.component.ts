import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose,
} from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { parse } from 'date-fns';
import { EmptyType } from 'app/enums/empty-type.enum';
import { JobState } from 'app/enums/job-state.enum';
import { EmptyConfig } from 'app/interfaces/empty-config.interface';
import { IpmiEvent } from 'app/interfaces/ipmi.interface';
import { FormatDateTimePipe } from 'app/modules/dates/pipes/format-date-time/format-datetime.pipe';
import { EmptyComponent } from 'app/modules/empty/empty.component';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { FakeProgressBarComponent } from 'app/modules/loader/components/fake-progress-bar/fake-progress-bar.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-ipmi-events-dialog',
  templateUrl: './ipmi-events-dialog.component.html',
  styleUrls: ['./ipmi-events-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FakeProgressBarComponent,
    MatDialogTitle,
    MatDialogContent,
    EmptyComponent,
    FormActionsComponent,
    MatDialogActions,
    MatButton,
    TestDirective,
    MatDialogClose,
    TranslateModule,
    FormatDateTimePipe,
  ],
})
export class IpmiEventsDialog implements OnInit {
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private translate = inject(TranslateService);

  protected readonly isLoading = signal(false);
  protected events: IpmiEvent[] = [];

  protected emptyConfig: EmptyConfig = {
    title: this.translate.instant('No events to display.'),
    type: EmptyType.NoPageData,
  };

  get canClear(): boolean {
    return this.events.length > 0 && !this.isLoading();
  }

  onClear(): void {
    this.isLoading.set(true);
    this.api.job('ipmi.sel.clear').pipe(untilDestroyed(this)).subscribe({
      next: (job) => {
        if (job.state !== JobState.Success) {
          return;
        }

        this.events = [];
      },
      complete: () => {
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorHandler.showErrorModal(error);
      },
    });
  }

  getEventDate(event: IpmiEvent): Date {
    return parse(`${event.date} ${event.time}`, 'MMM-dd-yyyy HH:mm:ss', new Date());
  }

  ngOnInit(): void {
    this.loadEvents();
  }

  private loadEvents(): void {
    this.isLoading.set(true);
    this.api.job('ipmi.sel.elist').pipe(untilDestroyed(this)).subscribe({
      next: (job) => {
        if (job.state !== JobState.Success) {
          return;
        }

        this.events = this.sortEvents(job.result);
      },
      complete: () => {
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorHandler.showErrorModal(error);
      },
    });
  }

  private sortEvents(events: IpmiEvent[]): IpmiEvent[] {
    return [...events].sort((a, b) => {
      const aDate = this.getEventDate(a);
      const bDate = this.getEventDate(b);

      return bDate.getTime() - aDate.getTime();
    });
  }
}
