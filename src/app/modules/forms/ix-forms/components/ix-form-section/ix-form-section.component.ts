import { ChangeDetectionStrategy, Component, ElementRef, HostBinding, input, OnDestroy, OnInit, inject } from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxFormService } from 'app/modules/forms/ix-forms/services/ix-form.service';

@UntilDestroy()
@Component({
  selector: 'ix-form-section',
  styleUrls: ['./ix-form-section.component.scss'],
  templateUrl: './ix-form-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxFieldsetComponent,
    MatDivider,
    TranslateModule,
  ],
})
export class IxFormSectionComponent implements OnInit, OnDestroy {
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private formService = inject(IxFormService);

  help = input<string>();
  label = input.required<string>();

  @HostBinding('attr.id')
  get id(): string {
    return this.label();
  }

  ngOnInit(): void {
    this.formService.registerSectionControl(
      null,
      this,
    );
  }

  ngOnDestroy(): void {
    this.formService.unregisterSectionControl(
      this,
      null,
    );
  }
}
