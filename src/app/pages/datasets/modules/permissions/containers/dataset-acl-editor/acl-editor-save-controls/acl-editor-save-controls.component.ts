import { ChangeDetectionStrategy, Component, input, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter, map, switchMap } from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { DirectoryServiceStatus } from 'app/enums/directory-services.enum';
import { Role } from 'app/enums/role.enum';
import { helptextAcl } from 'app/helptext/storage/volumes/datasets/dataset-acl';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { DatasetAclEditorStore } from 'app/pages/datasets/modules/permissions/stores/dataset-acl-editor.store';

@UntilDestroy()
@Component({
  selector: 'ix-acl-editor-save-controls',
  templateUrl: './acl-editor-save-controls.component.html',
  styleUrls: ['./acl-editor-save-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IxCheckboxComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class AclEditorSaveControlsComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private store = inject(DatasetAclEditorStore);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);
  private api = inject(ApiService);

  readonly canBeSaved = input(false);
  readonly ownerValues = input.required<{
    owner: string;
    ownerGroup: string;
    applyOwner: boolean;
    applyGroup: boolean;
  }>();

  protected saveParameters = this.formBuilder.nonNullable.group({
    recursive: [false],
    traverse: [false],
    validate_effective_acl: [true],
  });

  protected readonly helptext = helptextAcl;
  protected readonly Role = Role;

  ngOnInit(): void {
    this.setRecursiveCheckboxWarning();
  }

  // TODO: Move here and in other places to global store.
  protected readonly hasValidateAclCheckbox = toSignal(this.api.call('directoryservices.status').pipe(
    map((state) => state.status !== DirectoryServiceStatus.Disabled),
  ));

  protected onSavePressed(): void {
    const saveParameters = this.saveParameters.getRawValue();

    this.store.saveAcl({
      recursive: saveParameters.recursive,
      traverse: saveParameters.recursive && saveParameters.traverse,
      validateEffectiveAcl: saveParameters.validate_effective_acl,
      owner: this.ownerValues().owner,
      ownerGroup: this.ownerValues().ownerGroup,
      applyOwner: this.ownerValues().applyOwner,
      applyGroup: this.ownerValues().applyGroup,
    });
  }

  private setRecursiveCheckboxWarning(): void {
    this.saveParameters.controls.recursive.valueChanges.pipe(
      filter(Boolean),
      switchMap(() => {
        return this.dialogService.confirm({
          title: this.translate.instant(helptextAcl.recursiveDialogTitle),
          message: this.translate.instant(helptextAcl.recursiveDialogMessage),
        });
      }),
      untilDestroyed(this),
    ).subscribe((confirmed) => {
      if (confirmed) {
        return;
      }

      this.saveParameters.patchValue({ recursive: false });
    });
  }
}
