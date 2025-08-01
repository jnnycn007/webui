import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import {
  FormControl, FormGroup, Validators, ReactiveFormsModule,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogClose,
} from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { helptextAcl } from 'app/helptext/storage/volumes/datasets/dataset-acl';
import { AclTemplateByPath } from 'app/interfaces/acl.interface';
import { Option } from 'app/interfaces/option.interface';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxRadioGroupComponent } from 'app/modules/forms/ix-forms/components/ix-radio-group/ix-radio-group.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { IxValidatorsService } from 'app/modules/forms/ix-forms/services/ix-validators.service';
import { LoaderService } from 'app/modules/loader/loader.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import {
  SelectPresetModalConfig,
} from 'app/pages/datasets/modules/permissions/interfaces/select-preset-modal-config.interface';
import { DatasetAclEditorStore } from 'app/pages/datasets/modules/permissions/stores/dataset-acl-editor.store';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-select-preset-modal',
  templateUrl: 'select-preset-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    ReactiveFormsModule,
    IxRadioGroupComponent,
    IxSelectComponent,
    FormActionsComponent,
    MatButton,
    MatDialogClose,
    TestDirective,
    TranslateModule,
  ],
})
export class SelectPresetModalComponent implements OnInit {
  private dialogRef = inject<MatDialogRef<SelectPresetModalComponent>>(MatDialogRef);
  private api = inject(ApiService);
  private errorHandler = inject(ErrorHandlerService);
  private loader = inject(LoaderService);
  private aclEditorStore = inject(DatasetAclEditorStore);
  private validatorsService = inject(IxValidatorsService);
  data = inject<SelectPresetModalConfig>(MAT_DIALOG_DATA);

  form = new FormGroup({
    presetName: new FormControl('', this.validatorsService.validateOnCondition(
      (control) => control.parent?.get('usePreset')?.value,
      Validators.required,
    )),
    usePreset: new FormControl(true),
  });

  presetOptions$ = of<Option[]>([]);
  presets: AclTemplateByPath[] = [];

  readonly usePresetOptions$ = of([
    {
      label: helptextAcl.typeDialog.selectPreset,
      tooltip: helptextAcl.typeDialog.selectPresetTooltip,
      value: true,
    },
    {
      label: helptextAcl.typeDialog.createCustom,
      value: false,
    },
  ]);

  readonly helptext = helptextAcl.typeDialog;

  ngOnInit(): void {
    this.setFormRelations();
    this.loadOptions();
  }

  private setFormRelations(): void {
    this.form.controls.usePreset.valueChanges.pipe(untilDestroyed(this)).subscribe(() => {
      this.form.controls.presetName.updateValueAndValidity();
    });
  }

  private loadOptions(): void {
    this.api.call('filesystem.acltemplate.by_path', [{
      path: this.data.datasetPath,
      'format-options': {
        resolve_names: true,
      },
    }])
      .pipe(
        this.loader.withLoader(),
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe((presets) => {
        this.presets = presets;
        this.presetOptions$ = of(presets.map((preset) => ({
          label: preset.name,
          value: preset.name,
        })));
      });
  }

  onContinuePressed(): void {
    const { usePreset, presetName } = this.form.value;
    if (this.data.allowCustom && !usePreset) {
      this.dialogRef.close();
      return;
    }

    const selectedPreset = this.presets.find((preset) => preset.name === presetName);
    if (!selectedPreset) {
      throw new Error(`Preset ${presetName} not found`);
    }

    this.aclEditorStore.usePreset(selectedPreset);
    this.dialogRef.close();
  }
}
