import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, forwardRef, Signal, signal, viewChild, inject } from '@angular/core';
import {
  FormControl, ValidationErrors, Validators, ReactiveFormsModule,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { of, tap } from 'rxjs';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxIconGroupComponent } from 'app/modules/forms/ix-forms/components/ix-icon-group/ix-icon-group.component';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { SlotPosition } from 'app/pages/dashboard/types/slot-position.enum';
import { WidgetGroupSlot } from 'app/pages/dashboard/types/widget-group-slot.interface';
import {
  WidgetGroup,
  WidgetGroupLayout,
  layoutToSlotSizes,
  widgetGroupIcons,
} from 'app/pages/dashboard/types/widget-group.interface';
import { SlotSize, Widget } from 'app/pages/dashboard/types/widget.interface';
import { widgetRegistry } from 'app/pages/dashboard/widgets/all-widgets.constant';
import { WidgetEditorGroupComponent } from './widget-editor-group/widget-editor-group.component';
import { WidgetGroupSlotFormComponent } from './widget-group-slot-form/widget-group-slot-form.component';

@UntilDestroy()
@Component({
  selector: 'ix-widget-group-form',
  templateUrl: './widget-group-form.component.html',
  styleUrls: ['./widget-group-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxIconGroupComponent,
    WidgetEditorGroupComponent,
    WidgetGroupSlotFormComponent,
    FormActionsComponent,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class WidgetGroupFormComponent {
  slideInRef = inject<SlideInRef<WidgetGroup | undefined, WidgetGroup | false>>(SlideInRef);
  private cdr = inject(ChangeDetectorRef);

  protected group = signal<WidgetGroup>(
    { layout: WidgetGroupLayout.Full, slots: [{ type: null }] },
  );

  readonly widgetGroupSlotForm: Signal<WidgetGroupSlotFormComponent>
    = viewChild(forwardRef(() => WidgetGroupSlotFormComponent));

  selectedSlot = signal<WidgetGroupSlot<object>>({
    slotPosition: 0,
    slotSize: SlotSize.Full,
    type: null,
    settings: undefined,
  });

  protected validationErrors = signal([
    {} as ValidationErrors,
    {} as ValidationErrors,
    {} as ValidationErrors,
    {} as ValidationErrors,
  ]);

  protected layoutControl = new FormControl(
    WidgetGroupLayout.Full,
    { nonNullable: true, validators: [Validators.required] },
  );

  protected readonly layoutOptions = widgetGroupIcons;

  protected settingsHasErrors = computed<boolean>(() => {
    const validationErrors = this.validationErrors().slice(0, layoutToSlotSizes[this.group().layout].length);
    return validationErrors.some((errors) => !!Object.keys(errors).length);
  });

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(Boolean(this.layoutControl.dirty || this.widgetGroupSlotForm()?.form?.dirty));
    });

    this.setupLayoutUpdates();
    this.setInitialFormValues();
  }

  private setInitialFormValues(): void {
    const widgetGroup = this.slideInRef.getData();
    if (!widgetGroup) {
      this.group.set({ layout: WidgetGroupLayout.Full, slots: [{ type: null }] });
      return;
    }
    this.group.set(widgetGroup);
    this.layoutControl.setValue(this.group().layout);
    for (let slotPosition = 0; slotPosition < this.group().slots.length; slotPosition++) {
      this.updateSelectedSlot(slotPosition);
    }
    this.updateSelectedSlot(SlotPosition.First);
  }

  private setupLayoutUpdates(): void {
    this.layoutControl.valueChanges.pipe(
      tap((layout) => {
        this.group.update((group) => {
          const newGroup: WidgetGroup = { layout, slots: [] };
          const slotsCount = Math.max(layoutToSlotSizes[layout].length, group.slots.length);
          for (let i = 0; i < slotsCount; i++) {
            let slotConfig: Widget = group.slots[i];
            if (!slotConfig) {
              slotConfig = { type: null };
            }
            newGroup.slots.push(slotConfig);
          }
          return newGroup;
        });
        if (this.selectedSlot().slotSize !== layoutToSlotSizes[layout][this.selectedSlot().slotPosition]) {
          this.selectedSlotChanged(0);
        }
        this.cdr.markForCheck();
      }),
      untilDestroyed(this),
    ).subscribe();
  }

  protected selectedSlotChanged(slotIndex: SlotPosition): void {
    if (
      slotIndex === this.selectedSlot().slotPosition
      && this.selectedSlot().slotSize === layoutToSlotSizes[this.group().layout][slotIndex]
    ) {
      return;
    }
    this.updateSelectedSlot(slotIndex);
  }

  private updateSelectedSlot(slotPosition: SlotPosition): void {
    this.selectedSlot.update(() => {
      const group = this.group();
      return {
        slotPosition,
        type: group.slots[slotPosition].type,
        settings: group.slots[slotPosition].settings,
        slotSize: layoutToSlotSizes[group.layout][slotPosition],
      } as WidgetGroupSlot<object>;
    });
  }

  protected onSubmit(): void {
    this.cleanWidgetGroup();
    if (this.settingsHasErrors()) {
      return;
    }
    this.slideInRef.close({
      response: this.group(),
    });
  }

  private cleanWidgetGroup(): void {
    this.group.update((group) => {
      const newGroup: WidgetGroup = { layout: group.layout, slots: [] };
      const slotSizes = layoutToSlotSizes[group.layout];
      for (let i = 0; i < slotSizes.length; i++) {
        if (widgetRegistry[group.slots[i].type]?.supportedSizes.includes(slotSizes[i])) {
          newGroup.slots.push(group.slots[i]);
        } else {
          newGroup.slots.push({ type: null });
        }
      }
      return newGroup;
    });
  }

  protected updateSlotValidation([slotPosition, errors]: [SlotPosition, ValidationErrors]): void {
    this.validationErrors.update((validaitonErrors) => {
      const newErrors = [...validaitonErrors];
      newErrors[slotPosition] = errors;
      return newErrors;
    });
  }

  protected updateSlotSettings(slot: WidgetGroupSlot<object>): void {
    this.group.update((group) => {
      const newGroup: WidgetGroup = { layout: group.layout, slots: [] };
      const slotsCount = Math.max(layoutToSlotSizes[newGroup.layout].length, group.slots.length);
      for (let i = 0; i < slotsCount; i++) {
        const slotPosition = i as SlotPosition;
        if (slotPosition === slot.slotPosition) {
          newGroup.slots.push({
            type: slot.type,
            settings: slot.settings || undefined,
          });
        } else {
          newGroup.slots.push(group.slots[i]);
        }
      }
      return newGroup;
    });
  }
}
