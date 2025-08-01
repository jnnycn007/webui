import { ChangeDetectionStrategy, Component, effect, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Validators, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder } from '@ngneat/reactive-forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { getAllFormErrors } from 'app/modules/forms/ix-forms/utils/get-form-errors.utils';
import { ignoreTranslation } from 'app/modules/translate/translate.helper';
import { WidgetResourcesService } from 'app/pages/dashboard/services/widget-resources.service';
import { WidgetSettingsComponent } from 'app/pages/dashboard/types/widget-component.interface';
import { WidgetSettingsRef } from 'app/pages/dashboard/types/widget-settings-ref.interface';
import { WidgetPoolSettings } from 'app/pages/dashboard/widgets/storage/widget-pool/widget-pool.definition';

@UntilDestroy()
@Component({
  selector: 'ix-widget-pool-settings',
  templateUrl: './widget-pool-settings.component.html',
  styleUrl: './widget-pool-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IxSelectComponent,
    TranslateModule,
  ],
})
export class WidgetPoolSettingsComponent implements WidgetSettingsComponent<WidgetPoolSettings>, OnInit {
  widgetSettingsRef = inject<WidgetSettingsRef<WidgetPoolSettings>>(WidgetSettingsRef);
  private fb = inject(FormBuilder);
  private resources = inject(WidgetResourcesService);

  form = this.fb.nonNullable.group({
    poolId: [null as string | null, [Validators.required]],
  });

  protected poolOptions$ = this.resources.pools$.pipe(
    map((pools) => pools.map((pool) => ({
      label: ignoreTranslation(pool.name),
      value: String(pool.id),
    }))),
  );

  private firstOption = toSignal(this.poolOptions$.pipe(map((opts) => opts[0]?.value)));

  private readonly formFieldNames = ['poolId'];
  constructor() {
    effect(() => {
      const firstOption = this.firstOption();
      if (!this.widgetSettingsRef.getSettings()?.poolId && firstOption) {
        this.form.controls.poolId.setValue(firstOption);
      }
    });
  }

  ngOnInit(): void {
    this.setupSettingsUpdate();
    this.setCurrentSettings();
  }

  private setCurrentSettings(): void {
    const settings = this.widgetSettingsRef.getSettings();
    if (!settings) return;
    this.form.controls.poolId.setValue(settings.poolId);
  }

  private setupSettingsUpdate(): void {
    this.widgetSettingsRef.updateValidity(
      getAllFormErrors(this.form, this.formFieldNames),
    );
    this.form.valueChanges
      .pipe(
        map((settings) => settings.poolId),
        filter<string>((poolId) => !!poolId),
        untilDestroyed(this),
      )
      .subscribe({
        next: (poolId) => {
          this.widgetSettingsRef.updateSettings({ poolId });
          this.widgetSettingsRef.updateValidity(
            getAllFormErrors(this.form, this.formFieldNames),
          );
        },
      });
  }
}
