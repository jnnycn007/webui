import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { BaseAlertServiceForm } from 'app/pages/system/alert-service/alert-service/alert-services/base-alert-service-form';

@Component({
  selector: 'ix-pager-duty-service',
  templateUrl: './pager-duty-service.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IxInputComponent,
    TranslateModule,
  ],
})
export class PagerDutyServiceComponent extends BaseAlertServiceForm {
  private formBuilder = inject(FormBuilder);

  form = this.formBuilder.group({
    service_key: ['', Validators.required],
    client_name: ['', Validators.required],
  });
}
