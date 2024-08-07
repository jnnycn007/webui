import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { CommonDirectivesModule } from 'app/directives/common-directives.module';
import { IxIconModule } from 'app/modules/ix-icon/ix-icon.module';
import { JobItemComponent } from 'app/modules/jobs/components/job-item/job-item.component';
import { JobsPanelComponent } from 'app/modules/jobs/components/jobs-panel/jobs-panel.component';
import { JobEffects } from 'app/modules/jobs/store/job.effects';
import { jobReducer } from 'app/modules/jobs/store/job.reducer';
import { jobStateKey } from 'app/modules/jobs/store/job.selectors';
import { FormatDateTimePipe } from 'app/modules/pipes/format-date-time/format-datetime.pipe';
import { MapValuePipe } from 'app/modules/pipes/map-value/map-value.pipe';
import { TestIdModule } from 'app/modules/test-id/test-id.module';

@NgModule({
  imports: [
    CommonModule,
    StoreModule.forFeature(jobStateKey, jobReducer),
    EffectsModule.forFeature([JobEffects]),
    CommonDirectivesModule,
    RouterModule,
    TranslateModule,
    MatProgressBarModule,
    IxIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    TestIdModule,
    FormatDateTimePipe,
    MapValuePipe,
  ],
  declarations: [JobItemComponent, JobsPanelComponent],
  exports: [JobItemComponent, JobsPanelComponent],
})
export class JobsModule {}
