import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, input, output, inject } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { ChartSchemaNode } from 'app/interfaces/app.interface';
import { IxErrorsComponent } from 'app/modules/forms/ix-forms/components/ix-errors/ix-errors.component';
import { IxLabelComponent } from 'app/modules/forms/ix-forms/components/ix-label/ix-label.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { TranslatedString } from 'app/modules/translate/translate.helper';

@Component({
  selector: 'ix-list',
  templateUrl: './ix-list.component.html',
  styleUrls: ['./ix-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxLabelComponent,
    MatButton,
    IxErrorsComponent,
    TranslateModule,
    TestDirective,
  ],
})
export class IxListComponent implements AfterViewInit {
  private cdr = inject(ChangeDetectorRef);

  readonly formArray = input<AbstractControl>();
  readonly label = input<TranslatedString>();
  readonly tooltip = input<TranslatedString>();
  readonly empty = input<boolean>();
  readonly required = input<boolean>(false);
  readonly canAdd = input(true);
  // TODO: See if this belongs to the consuming component.
  readonly default = input<unknown[]>();
  // TODO: Does not belong to the scope of this component.
  readonly itemsSchema = input<ChartSchemaNode[]>();
  readonly isEditMode = input<boolean>();

  readonly add = output<ChartSchemaNode[] | undefined>();

  isDisabled = false;

  ngAfterViewInit(): void {
    if (!this.isEditMode() && Number(this.default()?.length) > 0) {
      this.handleListDefaults();
    }
  }

  addItem(schema?: ChartSchemaNode[]): void {
    this.add.emit(schema);
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  private handleListDefaults(): void {
    setTimeout(() => {
      this.default()?.forEach((defaultValue: never) => {
        this.addItem(
          this.itemsSchema()?.map((item: ChartSchemaNode) => {
            return {
              ...item,
              schema: {
                ...item.schema,
                default: defaultValue?.[item.variable] ?? (typeof defaultValue !== 'object' ? defaultValue : item.schema.default),
              },
            };
          }),
        );
      });

      this.cdr.markForCheck();
    });
  }
}
