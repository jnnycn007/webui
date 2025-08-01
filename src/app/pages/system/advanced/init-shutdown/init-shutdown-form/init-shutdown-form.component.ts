import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { FormBuilder, FormControl } from '@ngneat/reactive-forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Observable, of, Subscription } from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { InitShutdownScriptType, initShutdownScriptTypeLabels } from 'app/enums/init-shutdown-script-type.enum';
import { InitShutdownScriptWhen, initShutdownScriptWhenLabels } from 'app/enums/init-shutdown-script-when.enum';
import { Role } from 'app/enums/role.enum';
import { mapToOptions } from 'app/helpers/options.helper';
import { helptextInitShutdown } from 'app/helptext/system/init-shutdown';
import { InitShutdownScript } from 'app/interfaces/init-shutdown-script.interface';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import {
  ExplorerCreateDatasetComponent,
} from 'app/modules/forms/ix-forms/components/ix-explorer/explorer-create-dataset/explorer-create-dataset.component';
import { IxExplorerComponent } from 'app/modules/forms/ix-forms/components/ix-explorer/ix-explorer.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { FilesystemService } from 'app/services/filesystem.service';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'ix-init-shutdown-form',
  templateUrl: './init-shutdown-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxInputComponent,
    IxSelectComponent,
    IxExplorerComponent,
    IxCheckboxComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
    AsyncPipe,
    ExplorerCreateDatasetComponent,
  ],
})
export class InitShutdownFormComponent implements OnInit {
  private api = inject(ApiService);
  private errorHandler = inject(FormErrorHandlerService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private snackbar = inject(SnackbarService);
  private filesystemService = inject(FilesystemService);
  slideInRef = inject<SlideInRef<InitShutdownScript | undefined, boolean>>(SlideInRef);

  protected readonly requiredRoles = [Role.SystemCronWrite];

  get isNew(): boolean {
    return !this.editingScript;
  }

  get title(): string {
    return this.isNew
      ? this.translate.instant('Add Init/Shutdown Script')
      : this.translate.instant('Edit Init/Shutdown Script');
  }

  protected isFormLoading = signal(false);

  subscriptions: Subscription[] = [];

  readonly form = this.fb.group({
    comment: [''],
    type: [InitShutdownScriptType.Command],
    command: ['', [Validators.required]],
    script: ['', [Validators.required]],
    when: new FormControl(null as InitShutdownScriptWhen | null, [Validators.required]),
    enabled: [true],
    timeout: [10],
  });

  readonly isCommand$ = this.form.select((values) => values.type === InitShutdownScriptType.Command);

  readonly typeOptions$ = of(mapToOptions(initShutdownScriptTypeLabels, this.translate));
  readonly whenOptions$ = of(mapToOptions(initShutdownScriptWhenLabels, this.translate));

  readonly tooltips = {
    type: helptextInitShutdown.typeTooltip,
    command: helptextInitShutdown.commandTooltip,
    script: helptextInitShutdown.scriptTooltip,
    when: helptextInitShutdown.whenTooltip,
    timeout: helptextInitShutdown.timeoutTooltip,
  };

  readonly treeNodeProvider = this.filesystemService.getFilesystemNodeProvider();

  private editingScript: InitShutdownScript | undefined;

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });
    this.editingScript = this.slideInRef.getData();
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.form.controls.command.enabledWhile(this.isCommand$),
      this.form.controls.script.disabledWhile(this.isCommand$),
    );

    if (this.editingScript) {
      this.form.patchValue(this.editingScript);
    }
  }

  protected onSubmit(): void {
    const values = this.form.value;

    this.isFormLoading.set(true);
    let request$: Observable<unknown>;
    if (this.editingScript) {
      request$ = this.api.call('initshutdownscript.update', [
        this.editingScript.id,
        values,
      ]);
    } else {
      request$ = this.api.call('initshutdownscript.create', [values]);
    }

    request$.pipe(untilDestroyed(this)).subscribe({
      next: () => {
        if (this.isNew) {
          this.snackbar.success(this.translate.instant('Init/Shutdown Script created'));
        } else {
          this.snackbar.success(this.translate.instant('Init/Shutdown Script updated'));
        }
        this.isFormLoading.set(false);
        this.slideInRef.close({ response: true });
      },
      error: (error: unknown) => {
        this.isFormLoading.set(false);
        this.errorHandler.handleValidationErrors(error, this.form);
      },
    });
  }
}
