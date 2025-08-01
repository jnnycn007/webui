import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { helptextSystemCloudcredentials as helptext } from 'app/helptext/system/cloud-credentials';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import {
  BaseProviderFormComponent,
} from 'app/pages/credentials/backup-credentials/cloud-credentials-form/provider-forms/base-provider-form';

@UntilDestroy()
@Component({
  selector: 'ix-google-photos-provider-form',
  templateUrl: './google-photos-provider-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxFieldsetComponent,
    ReactiveFormsModule,
    IxInputComponent,
    TranslateModule,
  ],
})
export class GooglePhotosProviderFormComponent extends BaseProviderFormComponent implements AfterViewInit {
  private formBuilder = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  form = this.formBuilder.group({
    token: ['', Validators.required],
    client_id: ['', Validators.required],
    client_secret: ['', Validators.required],
  });

  readonly oauthTooltip = helptext.googlePhotosToken.oauth_tooltip;
  readonly tokenTooltip = helptext.googlePhotosToken.tooltip;

  ngAfterViewInit(): void {
    this.formPatcher$.pipe(untilDestroyed(this)).subscribe((values) => {
      this.form.patchValue(values);
      this.cdr.detectChanges();
    });
  }

  override getSubmitAttributes(): this['form']['value'] {
    return {
      ...this.form.value,
    };
  }
}
