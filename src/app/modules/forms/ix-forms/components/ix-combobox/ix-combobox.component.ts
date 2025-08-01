import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, input, OnInit, Signal, viewChild, inject } from '@angular/core';
import {
  ControlValueAccessor, NgControl,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatOption } from '@angular/material/core';
import { MatHint } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import {
  EMPTY,
  fromEvent,
  Subject,
} from 'rxjs';
import {
  catchError,
  debounceTime, distinctUntilChanged, map, takeUntil,
} from 'rxjs/operators';
import { Option } from 'app/interfaces/option.interface';
import { IxComboboxProvider } from 'app/modules/forms/ix-forms/components/ix-combobox/ix-combobox-provider';
import { IxErrorsComponent } from 'app/modules/forms/ix-forms/components/ix-errors/ix-errors.component';
import { IxLabelComponent } from 'app/modules/forms/ix-forms/components/ix-label/ix-label.component';
import { registeredDirectiveConfig } from 'app/modules/forms/ix-forms/directives/registered-control.directive';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { TestOverrideDirective } from 'app/modules/test-id/test-override/test-override.directive';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { TranslatedString } from 'app/modules/translate/translate.helper';

@UntilDestroy()
@Component({
  selector: 'ix-combobox',
  templateUrl: './ix-combobox.component.html',
  styleUrls: ['./ix-combobox.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxLabelComponent,
    MatInput,
    MatAutocompleteTrigger,
    MatProgressSpinner,
    IxIconComponent,
    MatAutocomplete,
    MatOption,
    IxErrorsComponent,
    MatHint,
    ReactiveFormsModule,
    TranslateModule,
    TestOverrideDirective,
    TestDirective,
  ],
  hostDirectives: [
    { ...registeredDirectiveConfig },
  ],
})
export class IxComboboxComponent implements ControlValueAccessor, OnInit {
  controlDirective = inject(NgControl);
  private cdr = inject(ChangeDetectorRef);

  readonly label = input<TranslatedString>();
  readonly hint = input<TranslatedString>();
  readonly required = input<boolean>(false);
  readonly tooltip = input<TranslatedString>();
  readonly allowCustomValue = input(false);

  readonly provider = input.required<IxComboboxProvider>();

  private readonly inputElementRef: Signal<ElementRef<HTMLInputElement>> = viewChild.required('ixInput', { read: ElementRef });
  private readonly autoCompleteRef = viewChild.required('auto', { read: MatAutocomplete });
  private readonly autocompleteTrigger = viewChild(MatAutocompleteTrigger);

  options: Option[] = [];
  getDisplayWith = this.displayWith.bind(this);
  hasErrorInOptions = false;
  loading = false;

  private filterChanged$ = new Subject<string>();

  value: string | number | null = '';
  isDisabled = false;
  filterValue: string | null | undefined;
  selectedOption: Option | null = null;
  textContent = '';

  onChange: (value: string | number | null) => void = (): void => {};
  onTouch: () => void = (): void => {};

  constructor() {
    this.controlDirective.valueAccessor = this;
  }

  writeValue(value: string | number): void {
    this.value = value;

    if (!this.value) {
      this.selectedOption = null;
    }
    if (this.value && this.options?.length) {
      let existingOption = this.options.find((option: Option) => option.value === this.value);
      if (!existingOption && this.allowCustomValue()) {
        existingOption = { label: this.value as string, value: this.value };
      }
      this.selectedOption = { ...existingOption };
    }
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    if (this.controlDirective.value) {
      this.textContent = this.controlDirective.value as string;
    }

    this.filterChanged$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      untilDestroyed(this),
    ).subscribe((changedValue) => {
      if (this.filterValue === changedValue) {
        return;
      }
      this.filterValue = changedValue;
      this.filterOptions(changedValue);
    });

    this.filterChanged$.next('');
  }

  inputBlurred(): void {
    this.onTouch();

    if (!this.allowCustomValue() && !this.selectedOption) {
      this.resetInput();
    }
  }

  filterOptions(filterValue: string): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.provider()?.fetch(filterValue).pipe(
      catchError(() => {
        this.hasErrorInOptions = true;
        return EMPTY;
      }),
      untilDestroyed(this),
    ).subscribe((options: Option[]) => {
      this.options = options;

      const selectedOptionFromLabel = this.options.find((option: Option) => option.label === filterValue);
      if (selectedOptionFromLabel) {
        this.selectedOption = selectedOptionFromLabel;
        this.value = selectedOptionFromLabel.value;
        this.onChange(this.value);
      } else if (this.value !== null) {
        const selectedOptionFromValue = this.options.find((option: Option) => option.value === this.value);
        this.selectedOption = selectedOptionFromValue
          ? { ...selectedOptionFromValue }
          : { label: this.value as string, value: this.value };
      }

      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  onOpenDropdown(): void {
    setTimeout(() => {
      const autoCompleteRef = this.autoCompleteRef();
      const autocompleteTrigger = this.autocompleteTrigger();
      if (
        !autoCompleteRef
        || !autocompleteTrigger
        || !autoCompleteRef.panel
      ) {
        return;
      }

      fromEvent((autoCompleteRef.panel as ElementRef<HTMLElement>).nativeElement, 'scroll')
        .pipe(
          debounceTime(300),
          map(() => (autoCompleteRef.panel as ElementRef<HTMLElement>).nativeElement.scrollTop),
          takeUntil(autocompleteTrigger.panelClosingActions),
          untilDestroyed(this),
        ).subscribe(() => {
          const {
            scrollTop,
            scrollHeight,
            clientHeight: elementHeight,
          } = autoCompleteRef.panel.nativeElement as HTMLElement;

          const atBottom = scrollHeight === scrollTop + elementHeight;
          if (!atBottom) {
            return;
          }

          this.loading = true;
          this.cdr.markForCheck();
          this.provider()?.nextPage(this.filterValue !== null && this.filterValue !== undefined ? this.filterValue : '')
            .pipe(untilDestroyed(this)).subscribe((options: Option[]) => {
              this.loading = false;
              this.cdr.markForCheck();
              /**
               * The following logic checks if we used a fake option to show value for an option that exists
               * on one of the following pages of the list of options for this combobox. If we have done so
               * previously, we want to remove that option if we managed to find the correct option on the
               * page we just fetched
               */
              const valueIndex = this.options.findIndex(
                (option) => option.label === (this.value as string) && option.value === this.value,
              );

              if (
                options.some((option) => option.value === this.value)
                && valueIndex >= 0
              ) {
                this.options.splice(valueIndex, 1);
              }
              this.options.push(...options);
              this.cdr.markForCheck();
            });
        });
    });
  }

  onChanged(changedValue: string): void {
    if (this.selectedOption?.value || this.value) {
      this.resetInput();
    }
    this.textContent = changedValue;
    this.filterChanged$.next(changedValue);

    if (this.allowCustomValue() && !this.options.some((option: Option) => option.value === changedValue)) {
      this.onChange(changedValue);
    }
  }

  resetInput(): void {
    this.filterChanged$.next('');
    if (this.inputElementRef()?.nativeElement) {
      this.inputElementRef().nativeElement.value = '';
    }
    this.selectedOption = null;
    this.value = null;
    this.textContent = '';
    this.onChange(null);
  }

  registerOnChange(onChange: (value: string | number) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouch = onTouched;
  }

  optionSelected(option: Option): void {
    this.selectedOption = { ...option };
    this.filterChanged$.next('');
    this.value = this.selectedOption.value;
    this.onChange(this.selectedOption.value);
  }

  displayWith(): string {
    return this.selectedOption ? this.selectedOption.label : '';
  }

  shouldShowResetInput(): boolean {
    return this.hasValue() && !this.isDisabled;
  }

  hasValue(): boolean {
    return !!this.inputElementRef()?.nativeElement?.value && this.inputElementRef().nativeElement.value.length > 0;
  }

  isValueFromOptions(value: string): boolean {
    return this.options.some((option: Option) => option.label === value);
  }

  setDisabledState?(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.cdr.markForCheck();
  }
}
