import { ChangeDetectionStrategy, ChangeDetectorRef, Component, input, OnChanges, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatStepperNext } from '@angular/material/stepper';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  map, combineLatest,
} from 'rxjs';
import { startWith } from 'rxjs/operators';
import { choicesToOptions } from 'app/helpers/operators/options.operators';
import { helptextPoolCreation } from 'app/helptext/storage/volumes/pool-creation/pool-creation';
import { Pool } from 'app/interfaces/pool.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { forbiddenAsyncValues } from 'app/modules/forms/ix-forms/validators/forbidden-values-validation/forbidden-values-validation';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { PoolWarningsComponent } from 'app/pages/storage/modules/pool-manager/components/pool-manager-wizard/components/pool-warnings/pool-warnings.component';
import { PoolWizardNameValidationService } from 'app/pages/storage/modules/pool-manager/components/pool-manager-wizard/steps/1-general-wizard-step/pool-wizard-name-validation.service';
import { PoolManagerStore } from 'app/pages/storage/modules/pool-manager/store/pool-manager.store';

const defaultEncryptionStandard = 'AES-256-GCM';

@UntilDestroy()
@Component({
  selector: 'ix-general-wizard-step',
  templateUrl: './general-wizard-step.component.html',
  styleUrls: ['./general-wizard-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IxInputComponent,
    IxCheckboxComponent,
    IxSelectComponent,
    PoolWarningsComponent,
    FormActionsComponent,
    MatButton,
    MatStepperNext,
    TestDirective,
    TranslateModule,
  ],
})
export class GeneralWizardStepComponent implements OnInit, OnChanges {
  private api = inject(ApiService);
  private formBuilder = inject(FormBuilder);
  private dialog = inject(DialogService);
  private translate = inject(TranslateService);
  private store = inject(PoolManagerStore);
  private cdr = inject(ChangeDetectorRef);
  private poolWizardNameValidationService = inject(PoolWizardNameValidationService);

  readonly isAddingVdevs = input(false);
  readonly pool = input<Pool | undefined>(undefined);

  form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    encryption: [false],
    encryptionStandard: [defaultEncryptionStandard, Validators.required],
  });

  isLoading$ = this.store.isLoading$;
  poolNames$ = this.api.call('pool.query', [[], { select: ['name'], order_by: ['name'] }]).pipe(
    map((pools) => pools.map((pool) => pool.name)),
  );

  private readonly oldNameForbiddenValidator = forbiddenAsyncValues(this.poolNames$);

  readonly encryptionAlgorithmOptions$ = this.api
    .call('pool.dataset.encryption_algorithm_choices')
    .pipe(choicesToOptions());

  ngOnChanges(): void {
    if (this.isAddingVdevs()) {
      this.form.controls.encryption.disable();
      this.form.controls.encryptionStandard.disable();
      this.form.controls.name.setValue(this.pool()?.name || '');
      this.form.controls.name.removeAsyncValidators(this.oldNameForbiddenValidator);
      this.form.controls.name.updateValueAndValidity();
    } else {
      this.form.controls.name.addAsyncValidators([
        this.oldNameForbiddenValidator,
        this.poolWizardNameValidationService.validatePoolName,
      ]);
      this.form.controls.name.updateValueAndValidity();
    }
  }

  ngOnInit(): void {
    this.initEncryptionField();
    this.connectGeneralOptionsToStore();

    this.store.startOver$.pipe(untilDestroyed(this)).subscribe(() => {
      this.form.reset({
        encryptionStandard: defaultEncryptionStandard,
      });
    });
  }

  private initEncryptionField(): void {
    this.form.controls.encryption.valueChanges.pipe(untilDestroyed(this)).subscribe((isEncrypted) => {
      if (!isEncrypted) {
        return;
      }

      this.dialog
        .confirm({
          title: this.translate.instant('Warning'),
          message: this.translate.instant(helptextPoolCreation.encryptionMessage),
          buttonText: this.translate.instant('I Understand'),
        })
        .pipe(untilDestroyed(this))
        .subscribe((confirmed) => {
          if (!confirmed) {
            this.form.controls.encryption.setValue(false);
          }
          this.cdr.markForCheck();
        });
    });
  }

  private connectGeneralOptionsToStore(): void {
    combineLatest([
      this.form.controls.name.statusChanges,
      this.form.controls.name.valueChanges.pipe(startWith('')),
      this.form.controls.encryption.valueChanges.pipe(startWith(false)),
      this.form.controls.encryptionStandard.valueChanges.pipe(startWith('AES-256-GCM')),
    ]).pipe(untilDestroyed(this)).subscribe(([, name, encryption, encryptionStandard]) => {
      this.store.setGeneralOptions({
        name,
        nameErrors: this.form.controls.name.errors,
        encryption: encryption ? encryptionStandard : null,
      });
    });
  }
}
