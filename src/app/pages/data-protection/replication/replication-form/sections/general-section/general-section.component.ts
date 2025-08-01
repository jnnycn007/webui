import { ChangeDetectionStrategy, Component, input, OnChanges, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { Direction, directionNames } from 'app/enums/direction.enum';
import { LoggingLevel, loggingLevelNames } from 'app/enums/logging-level.enum';
import { TransportMode } from 'app/enums/transport-mode.enum';
import { mapToOptions } from 'app/helpers/options.helper';
import { helptextReplication } from 'app/helptext/data-protection/replication/replication';
import { ReplicationCreate, ReplicationTask } from 'app/interfaces/replication-task.interface';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';

@Component({
  selector: 'ix-replication-general-section',
  templateUrl: './general-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxFieldsetComponent,
    ReactiveFormsModule,
    IxInputComponent,
    IxSelectComponent,
    IxCheckboxComponent,
    TranslateModule,
  ],
})
export class GeneralSectionComponent implements OnChanges {
  private formBuilder = inject(FormBuilder);
  private translate = inject(TranslateService);

  readonly replication = input<ReplicationTask>();

  form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    direction: [Direction.Push],
    transport: [TransportMode.Ssh],
    retries: [5],
    logging_level: [LoggingLevel.Default],
    sudo: [false],
    enabled: [true],
  });

  readonly directions$ = of(mapToOptions(directionNames, this.translate));
  readonly loggingLevels$ = of(mapToOptions(loggingLevelNames, this.translate));
  readonly transports$ = of([
    {
      label: 'SSH',
      value: TransportMode.Ssh,
    },
    {
      label: 'SSH+NETCAT',
      value: TransportMode.Netcat,
    },
    {
      label: 'LOCAL',
      value: TransportMode.Local,
    },
  ]);

  readonly helptext = helptextReplication;

  get isLocal(): boolean {
    return this.form.controls.transport.value === TransportMode.Local;
  }

  ngOnChanges(): void {
    const replication = this.replication();
    if (replication) {
      this.form.patchValue({
        ...replication,
        logging_level: replication.logging_level || LoggingLevel.Default,
      });
    }
  }

  getPayload(): Partial<ReplicationCreate> {
    return {
      ...this.form.value,
      logging_level: this.form.value.logging_level === LoggingLevel.Default ? null : this.form.value.logging_level,
    };
  }
}
