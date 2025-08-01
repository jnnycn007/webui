import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Validators, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder } from '@ngneat/reactive-forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { getAllFormErrors } from 'app/modules/forms/ix-forms/utils/get-form-errors.utils';
import { WidgetSettingsComponent } from 'app/pages/dashboard/types/widget-component.interface';
import { WidgetSettingsRef } from 'app/pages/dashboard/types/widget-settings-ref.interface';
import { WidgetArbitraryTextSettings } from 'app/pages/dashboard/widgets/custom/arbitrary-text/widget-arbitrary-text.definition';

@UntilDestroy()
@Component({
  selector: 'ix-widget-arbitrary-text-settings',
  templateUrl: './widget-arbitrary-text-settings.component.html',
  styleUrl: './widget-arbitrary-text-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IxInputComponent,
    TranslateModule,
  ],
})
export class WidgetArbitraryTextSettingsComponent implements
  WidgetSettingsComponent<WidgetArbitraryTextSettings>, OnInit {
  widgetSettingsRef = inject<WidgetSettingsRef<WidgetArbitraryTextSettings>>(WidgetSettingsRef);
  private fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    widgetTitle: [null as string | null, [Validators.required, Validators.maxLength(20)]],
    widgetText: [null as string | null, [Validators.required, Validators.maxLength(130)]],
    widgetSubText: [null as string | null, [Validators.maxLength(64)]],
  });

  private readonly formFieldNames = ['widgetTitle', 'widgetText', 'widgetSubText'];

  ngOnInit(): void {
    this.setupSettingsUpdate();
    this.setCurrentSettings();
  }

  private setCurrentSettings(): void {
    const settings = this.widgetSettingsRef.getSettings();
    if (!settings) {
      return;
    }
    this.form.controls.widgetTitle.setValue(settings.widgetTitle || null);
    this.form.controls.widgetText.setValue(settings.widgetText || null);
    this.form.controls.widgetSubText.setValue(settings?.widgetSubText || null);
  }

  private setupSettingsUpdate(): void {
    this.widgetSettingsRef.updateValidity(
      getAllFormErrors(this.form, this.formFieldNames),
    );
    this.form.valueChanges.pipe(untilDestroyed(this)).subscribe({
      next: (settings) => {
        this.widgetSettingsRef.updateSettings({
          widgetTitle: settings.widgetTitle || '',
          widgetText: settings.widgetText || '',
          widgetSubText: settings.widgetSubText || '',
        });

        this.widgetSettingsRef.updateValidity(
          getAllFormErrors(this.form, this.formFieldNames),
        );
      },
    });
  }
}
