import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { DetailsItemComponent } from 'app/modules/details-table/details-item/details-item.component';
import { DetailsTableComponent } from 'app/modules/details-table/details-table.component';
import { EditableComponent } from 'app/modules/forms/editable/editable.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import {
  BaseProviderFormComponent,
} from 'app/pages/credentials/backup-credentials/cloud-credentials-form/provider-forms/base-provider-form';

@UntilDestroy()
@Component({
  selector: 'ix-s3-provider-form',
  styleUrls: ['./s3-provider-form.component.scss'],
  templateUrl: './s3-provider-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxInputComponent,
    IxCheckboxComponent,
    DetailsTableComponent,
    DetailsItemComponent,
    EditableComponent,
    TranslateModule,
  ],
})
export class S3ProviderFormComponent extends BaseProviderFormComponent implements AfterViewInit {
  private formBuilder = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  form = this.formBuilder.group({
    access_key_id: ['', Validators.required],
    secret_access_key: ['', Validators.required],

    max_upload_parts: [null as number | null],
    endpoint: [''],
    region: [''],
    skip_region: [false],
    signatures_v2: [false],
  });

  ngAfterViewInit(): void {
    this.formPatcher$.pipe(untilDestroyed(this)).subscribe((values) => {
      this.form.patchValue(values);
      this.cdr.detectChanges();
    });
  }
}
