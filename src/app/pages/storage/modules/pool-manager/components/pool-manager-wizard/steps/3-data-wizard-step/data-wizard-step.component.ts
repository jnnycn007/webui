import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, input, OnInit, output, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatStepperPrevious, MatStepperNext } from '@angular/material/stepper';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { map } from 'rxjs';
import { CreateVdevLayout, TopologyItemType, VDevType } from 'app/enums/v-dev-type.enum';
import { helptextPoolCreation } from 'app/helptext/storage/volumes/pool-creation/pool-creation';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import {
  AddVdevsStore,
} from 'app/pages/storage/modules/pool-manager/components/add-vdevs/store/add-vdevs-store.service';
import { LayoutStepComponent } from 'app/pages/storage/modules/pool-manager/components/pool-manager-wizard/components/layout-step/layout-step.component';
import { PoolManagerStore } from 'app/pages/storage/modules/pool-manager/store/pool-manager.store';
import { parseDraidVdevName } from 'app/pages/storage/modules/pool-manager/utils/topology.utils';

@UntilDestroy()
@Component({
  selector: 'ix-data-wizard-step',
  templateUrl: './data-wizard-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LayoutStepComponent,
    FormActionsComponent,
    MatButton,
    MatStepperPrevious,
    TestDirective,
    MatStepperNext,
    TranslateModule,
    AsyncPipe,
  ],
})
export class DataWizardStepComponent implements OnInit {
  private store = inject(PoolManagerStore);
  private addVdevsStore = inject(AddVdevsStore);
  private cdr = inject(ChangeDetectorRef);

  readonly isStepActive = input.required<boolean>();
  readonly stepWarning = input<string | null>();

  readonly goToLastStep = output();

  protected readonly vDevType = VDevType;
  protected readonly inventory$ = this.store.getInventoryForStep(VDevType.Data);
  protected allowedLayouts = Object.values(CreateVdevLayout) as CreateVdevLayout[];
  readonly helptext = helptextPoolCreation;
  canChangeLayout = true;

  ngOnInit(): void {
    this.addVdevsStore.pool$.pipe(
      map((pool) => pool?.topology[VDevType.Data]),
      untilDestroyed(this),
    ).subscribe((dataTopology) => {
      if (!dataTopology?.length) {
        return;
      }
      // TODO: Similar code in poolTopologyToStoreTopology
      let type = dataTopology[0].type;
      if (type === TopologyItemType.Disk && !dataTopology[0].children.length) {
        type = TopologyItemType.Stripe;
      } else if (type === TopologyItemType.Draid) {
        const parsedVdevName = parseDraidVdevName(dataTopology[0].name);
        type = parsedVdevName.layout as unknown as TopologyItemType;
      }
      this.allowedLayouts = [type] as unknown as CreateVdevLayout[];
      this.canChangeLayout = false;
      this.cdr.markForCheck();
    });
  }

  goToReviewStep(): void {
    this.goToLastStep.emit();
  }

  resetStep(): void {
    this.store.resetStep(VDevType.Data);
  }
}
