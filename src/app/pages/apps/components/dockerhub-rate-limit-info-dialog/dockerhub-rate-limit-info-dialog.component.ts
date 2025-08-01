import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent,
} from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { formatDistance } from 'date-fns';
import { helptextApps } from 'app/helptext/apps/apps';
import { DockerHubRateLimit } from 'app/interfaces/dockerhub-rate-limit.interface';
import { TestDirective } from 'app/modules/test-id/test.directive';

@UntilDestroy()
@Component({
  selector: 'ix-dockerhub-rate-info-dialog',
  templateUrl: './dockerhub-rate-limit-info-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    TestDirective,
    MatDialogClose,
    RouterLink,
  ],
})
export class DockerHubRateInfoDialog {
  private translate = inject(TranslateService);
  data = inject<DockerHubRateLimit>(MAT_DIALOG_DATA);

  helpText = helptextApps;

  get warningText(): string {
    return this.translate.instant(
      this.helpText.dockerHubRateLimit.message,
      {
        seconds: formatDistance(0, Number(this.data.remaining_time_limit_in_secs) * 1000, { includeSeconds: true }),
      },
    );
  }
}
