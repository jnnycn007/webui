import { ChangeDetectionStrategy, Component, input, OnChanges, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import {
  PosixAclTag, posixAclTagLabels, PosixPermission, posixPermissionLabels,
} from 'app/enums/posix-acl.enum';
import { mapToOptions } from 'app/helpers/options.helper';
import { helptextAcl } from 'app/helptext/storage/volumes/datasets/dataset-acl';
import { PosixAclItem } from 'app/interfaces/acl.interface';
import { GroupComboboxProvider } from 'app/modules/forms/ix-forms/classes/group-combobox-provider';
import { UserComboboxProvider } from 'app/modules/forms/ix-forms/classes/user-combobox-provider';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxCheckboxListComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox-list/ix-checkbox-list.component';
import { IxComboboxComponent } from 'app/modules/forms/ix-forms/components/ix-combobox/ix-combobox.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { DatasetAclEditorStore } from 'app/pages/datasets/modules/permissions/stores/dataset-acl-editor.store';
import { UserService } from 'app/services/user.service';

@UntilDestroy()
@Component({
  selector: 'ix-edit-posix-ace',
  templateUrl: './edit-posix-ace.component.html',
  styleUrls: ['./edit-posix-ace.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxSelectComponent,
    IxComboboxComponent,
    IxCheckboxListComponent,
    IxCheckboxComponent,
    TranslateModule,
  ],
})
export class EditPosixAceComponent implements OnInit, OnChanges {
  private userService = inject(UserService);
  private store = inject(DatasetAclEditorStore);
  private formBuilder = inject(FormBuilder);
  private translate = inject(TranslateService);

  readonly ace = input.required<PosixAclItem>();

  form = this.formBuilder.nonNullable.group({
    tag: [null as PosixAclTag | null],
    user: [null as string | null],
    group: [null as string | null],
    permissions: [[] as PosixPermission[]],
    default: [false],
  });

  readonly tags$ = of(mapToOptions(posixAclTagLabels, this.translate));
  readonly permissions$ = of(mapToOptions(posixPermissionLabels, this.translate));

  readonly tooltips = {
    user: helptextAcl.userTooltip,
    group: helptextAcl.groupTooltip,
  };

  readonly userProvider = new UserComboboxProvider(this.userService);
  readonly groupProvider = new GroupComboboxProvider(this.userService);

  get isUserTag(): boolean {
    return this.form.value.tag === PosixAclTag.User;
  }

  get isGroupTag(): boolean {
    return this.form.value.tag === PosixAclTag.Group;
  }

  ngOnChanges(): void {
    this.updateFormValues();
  }

  ngOnInit(): void {
    this.setFormListeners();
    this.updateFormValues();
  }

  private setFormListeners(): void {
    this.form.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe(() => this.onAceUpdated());
    this.form.statusChanges
      .pipe(untilDestroyed(this))
      .subscribe(() => this.onFormStatusUpdated());
  }

  private onFormStatusUpdated(): void {
    this.store.updateSelectedAceValidation(this.form.valid);
  }

  private onAceUpdated(): void {
    const updatedAce = this.formValuesToAce();
    this.store.updateSelectedAce(updatedAce);
  }

  private formValuesToAce(): PosixAclItem {
    const formValues = this.form.getRawValue();

    const ace = {
      tag: formValues.tag,
      default: formValues.default,
      perms: {
        [PosixPermission.Read]: formValues.permissions.includes(PosixPermission.Read),
        [PosixPermission.Write]: formValues.permissions.includes(PosixPermission.Write),
        [PosixPermission.Execute]: formValues.permissions.includes(PosixPermission.Execute),
      },
    } as PosixAclItem;

    if (this.isUserTag) {
      ace.who = formValues.user || undefined;
    } else if (this.isGroupTag) {
      ace.who = formValues.group || undefined;
    }

    return ace;
  }

  private updateFormValues(): void {
    const userField = this.form.controls.user;
    const groupField = this.form.controls.group;

    userField.clearValidators();
    groupField.clearValidators();

    if (this.isUserTag) {
      userField.addValidators(Validators.required);
    } else if (this.isGroupTag) {
      groupField.addValidators(Validators.required);
    }

    const formValues = {
      tag: this.ace().tag,
      user: this.isUserTag ? this.ace().who : null,
      group: this.isGroupTag ? this.ace().who : null,
      default: this.ace().default,
      permissions: Object.entries(this.ace().perms)
        .filter(([, isOn]: [string, boolean]) => isOn)
        .map(([permission]) => permission as PosixPermission),
    };

    this.form.patchValue(formValues, { emitEvent: false });
    this.form.markAllAsTouched();

    this.onFormStatusUpdated();
  }
}
