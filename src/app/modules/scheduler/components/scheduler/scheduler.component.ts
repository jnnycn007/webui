import { ChangeDetectionStrategy, ChangeDetectorRef, Component, input, inject } from '@angular/core';
import {
  ControlValueAccessor, NgControl, ReactiveFormsModule, FormsModule,
} from '@angular/forms';
import { MatOptionSelectionChange, MatOption } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSelect } from '@angular/material/select';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { IxErrorsComponent } from 'app/modules/forms/ix-forms/components/ix-errors/ix-errors.component';
import { IxLabelComponent } from 'app/modules/forms/ix-forms/components/ix-label/ix-label.component';
import {
  SchedulerModalConfig,
} from 'app/modules/scheduler/components/scheduler-modal/scheduler-modal-config.interface';
import {
  SchedulerModalComponent,
} from 'app/modules/scheduler/components/scheduler-modal/scheduler-modal.component';
import { CrontabExplanationPipe } from 'app/modules/scheduler/pipes/crontab-explanation.pipe';
import { CronPresetValue, getDefaultCrontabPresets } from 'app/modules/scheduler/utils/get-default-crontab-presets.utils';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { TranslatedString } from 'app/modules/translate/translate.helper';

@UntilDestroy()
@Component({
  selector: 'ix-scheduler',
  templateUrl: './scheduler.component.html',
  styleUrls: ['./scheduler.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxLabelComponent,
    MatSelect,
    ReactiveFormsModule,
    TestDirective,
    FormsModule,
    MatOption,
    IxErrorsComponent,
    TranslateModule,
    CrontabExplanationPipe,
  ],
})
export class SchedulerComponent implements ControlValueAccessor {
  controlDirective = inject(NgControl);
  private matDialog = inject(MatDialog);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  readonly label = input<TranslatedString>();
  readonly tooltip = input<TranslatedString>();
  readonly required = input(false);
  readonly hideMinutes = input(false);

  protected readonly customValue = 'custom';
  /**
   * Optional extra time boundaries for every day, i.e. "15:30" - "23:30"
   */
  readonly startTime = input<string>();
  readonly endTime = input<string>();

  readonly defaultPresets = getDefaultCrontabPresets(this.translate);

  isDisabled = false;
  crontab: string;
  customCrontab: string | null;

  onTouched: () => void;
  onChange: (crontab: string) => void;

  constructor() {
    this.controlDirective.valueAccessor = this;
  }

  registerOnChange(onChange: (crontab: string) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  writeValue(crontab: string): void {
    this.crontab = crontab;
    const isDefaultPreset = this.defaultPresets.some((preset) => preset.value === crontab);
    if (!isDefaultPreset && crontab) {
      this.customCrontab = crontab;
    }

    this.cdr.markForCheck();
  }

  private onCustomOptionSelected(previousValue: string | undefined): void {
    this.matDialog.open(SchedulerModalComponent, {
      data: {
        startTime: this.startTime(),
        endTime: this.endTime(),
        hideMinutes: this.hideMinutes(),
        crontab: previousValue,
      } as SchedulerModalConfig,
    })
      .afterClosed()
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe((newCrontab: string) => {
        if (Object.values(CronPresetValue).includes(newCrontab as CronPresetValue)) {
          this.customCrontab = null;
        } else {
          this.customCrontab = newCrontab;
        }
        this.cdr.markForCheck();
        this.crontab = newCrontab;
        this.onChange(newCrontab);
        this.cdr.markForCheck();
      });
  }

  onOptionSelectionChange(value: MatOptionSelectionChange<string>): void {
    if (!value.source.selected) {
      return;
    }
    if (!value.isUserInput) {
      return;
    }
    const selection = value.source.value as CronPresetValue;
    if (selection.toString() === this.customValue) {
      this.onCustomOptionSelected(undefined);
    } else if (!Object.values(CronPresetValue).includes(selection)) {
      this.onCustomOptionSelected(selection);
    } else {
      this.crontab = selection;
      this.customCrontab = null;
      this.onChange(selection);
      this.cdr.markForCheck();
    }
  }
}
