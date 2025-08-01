import { ChangeDetectionStrategy, Component, computed, input, inject } from '@angular/core';
import {
  MatCard, MatCardHeader, MatCardTitle, MatCardContent,
} from '@angular/material/card';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { CloudBackup } from 'app/interfaces/cloud-backup.interface';
import { ScheduleDescriptionPipe } from 'app/modules/dates/pipes/schedule-description/schedule-description.pipe';
import { scheduleToCrontab } from 'app/modules/scheduler/utils/schedule-to-crontab.utils';

@Component({
  selector: 'ix-cloud-backup-schedule',
  templateUrl: './cloud-backup-schedule.component.html',
  styleUrl: './cloud-backup-schedule.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    TranslateModule,
    ScheduleDescriptionPipe,
  ],
})
export class CloudBackupScheduleComponent {
  private translate = inject(TranslateService);

  readonly backup = input.required<CloudBackup>();

  protected readonly schedule = computed(() => {
    return this.backup().enabled ? scheduleToCrontab(this.backup().schedule) : this.translate.instant('Disabled');
  });
}
